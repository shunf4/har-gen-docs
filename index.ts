import HTTPSnippet from 'httpsnippet'
import commandLineArgs from 'command-line-args'
import fs2 from 'fs'
import fs from 'fs/promises'
import prettier from 'prettier'
import { Har } from 'har-format'
import { JSDOM } from 'jsdom'

const main = async () => {
    const options: any = commandLineArgs([
        { name: 'src', type: String, defaultOption: true, defaultValue: "test.har" },
        { name: 'out', type: String, alias: 'o' },
    ])
    const c = await fs.readFile(options.src, "utf-8")
    const har: Har = JSON.parse(c)

    const outStream = fs2.createWriteStream(options.out || (options.src + ".html"), {
        encoding: "utf-8",
    })

    const dom = new JSDOM(`<!DOCTYPE html>`)
    const d = dom.window.document

    const style = d.createElement("style")
    style.textContent = `
        .request .code {
            color: #9a681f;
        }
        .response .code {
            color: #17a416;
        }
        .response .code-wrapper, .response.code-wrapper {
            color: #17a416;
            margin: 0;
        }

        .code {
            color: #1a4ae8;
            margin: 0;
        }

        .code-wrapper {
            margin-left: 2em;
            background: #f2f2f2;
            padding: 10px;
            font-size: large;
        }
    `
    d.head.appendChild(style)

    const toc = d.createElement('ul')
    d.body.appendChild(toc)

    const appendP = (s: string) => {
        const p = d.createElement('p')
        p.textContent = s
        d.body.appendChild(p)
    }

    const appendH4 = (s: string) => {
        const e = d.createElement('h4')
        e.textContent = s
        d.body.appendChild(e)
    }

    const appendHr = () => {
        const e = d.createElement('hr')
        d.body.appendChild(e)
    }

    
    let entryI = 0
    for (const {request, response, comment} of har.log.entries) {
        if (entryI > 0) {
            appendHr()
        }
        const h3 = d.createElement('h3')
        h3.setAttribute("id", `api-${entryI}`)
        h3.textContent = `${entryI}. ${comment}`
        d.body.appendChild(h3)

        const tocLi = d.createElement('li')
        const tocA = d.createElement('a')
        tocA.setAttribute('href', `#api-${entryI}`)
        tocA.textContent = `${entryI}. ${comment}`
        tocLi.appendChild(tocA)
        
        toc.appendChild(tocLi)

        if (request.url === "") {
            request.url = "http://UNKNOWN-URL.com"
        }

        const urlDiv = d.createElement('div')
        const urlPre = d.createElement('pre')
        urlPre.textContent = request.url
        urlPre.classList.add("code")
        urlDiv.appendChild(urlPre)
        urlDiv.classList.add("code-wrapper")
        d.body.append(urlDiv)

        appendP(`描述：`)
        appendP(``)
        appendH4(`>>> Request >>>`)

        

        const reqDiv = d.createElement('div')
        const reqPre = d.createElement('pre')
        // reqPre.textContent = new HTTPSnippet(request).convert('javascript', 'fetch') || "错误"
        reqPre.textContent = new HTTPSnippet(request).convert('http', 'http/1.1') || "错误"
        reqPre.classList.add("code")
        reqDiv.appendChild(reqPre)
        reqDiv.classList.add("code-wrapper")
        reqDiv.classList.add("request")
        d.body.append(reqDiv)

        appendH4(`<<< Response <<<`)

        let responseDetails = `${response.httpVersion} ${response.status} ${response.statusText}\n`
        let responseSummary = `${response.status} ${response.statusText}`

        responseDetails += `Cookies:\n`

        for (const cookie of response.cookies) {
            const { name, value } = cookie
            responseDetails += `    ${name}=${value}`

            for (const [k, v] of Object.entries(cookie)) {
                responseDetails += `    ${k}=${v}`
            }
            responseDetails += `\n`
        }

        responseDetails += `\nHeaders:\n`
        for (const {name, value} of response.headers) {
            responseDetails += `    ${name}: ${value}\n`
        }

        responseDetails += `\nContent:\n`
        let content = response.content.text || ""
        if (content.indexOf("�") !== -1) {
            content = "(Binary data)"
        }
        const originalContent = content

        if (response.content.mimeType.indexOf("json") !== -1) {
            try {
                content = JSON.stringify(JSON.parse(content), undefined, "  ")
            } catch (e) {
                console.warn(`JSON convert failed: ${e}`)
            }
        }

        responseDetails += content

        const origContentWithoutNewline = originalContent.replace("\n", "").replace("\r", "")
        responseSummary += origContentWithoutNewline.substring(0, 120) + (origContentWithoutNewline.length > 120 ? "..." : "") + " （点击展开折叠）"

        const responseDetailsElem = d.createElement('details')
        responseDetailsElem.classList.add("response")
        responseDetailsElem.classList.add("code-wrapper")
        const responseDetailsPreElem = d.createElement('pre')
        responseDetailsPreElem.classList.add("code")
        const responseSummaryElem = d.createElement('summary')
        responseSummaryElem.textContent = responseSummary
        responseDetailsPreElem.textContent = responseDetails
        responseDetailsElem.appendChild(responseSummaryElem)
        responseDetailsElem.appendChild(responseDetailsPreElem)

        d.body.appendChild(responseDetailsElem)

        entryI++
    }

    outStream.write(prettier.format(dom.serialize(), { parser: 'html'}))
    outStream.end()

    console.log(`已生成 ${options.out || (options.src + ".html")}。`)

}

main().catch(e => {
    console.error(e)
})
