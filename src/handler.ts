import { Router } from "itty-router"
import parser, { HTMLElement } from "node-html-parser"

type HTMLOptions = {
  authorName: string
  targetUrl: string
  videoUrl: string
  title: string
}

function generateHTML(selfUrl: URL, options: HTMLOptions): string {
  const { authorName, targetUrl, videoUrl, title } = options

  const urlPath = new URL(videoUrl)
  const urlFragment = urlPath.pathname.replace(/\/$/, "") + ".mp4"
  const url = `${selfUrl.protocol}//${selfUrl.hostname}/_video${urlFragment}`
  return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Fixtiktok</title>
            <meta content="#fe2c55" data-react-helmet="true" name="theme-color" />
            <meta name="og:site_name"          content="FixTikTok" />
            <meta name="og:url"                content="${targetUrl}" />

            <meta name="twitter:card"                       content="player" />
            <meta name="twitter:player:width"               content="720" />
            <meta name="twitter:player:height"              content="480" />
            <meta name="twitter:player:stream"              content="${url}" />
            <meta name="twitter:player:stream:content_type" content="video/mp4" />
            <meta name="twitter:site"              content="${authorName}" />
            <meta name="twitter:title"              content="${title}" />
            <!-- <meta name="twitter:description"              content="${title}" /> -->

            <meta name="og:title"              content="${title}" />
            <meta name="description" content="${title}" />
            <meta name="og:video"              content="${url}" />
            <meta name="og:video:secure_url"   content="${url}" />
            <meta name="og:video:type"         content="video/mp4" />
            <meta name="og:video:width"        content="720" />
            <meta name="og:video:height"       content="480" />
            <!-- <meta name="og:description"              content="${title}" />-->
            <meta http-equiv = "refresh" content = "0; url = ${targetUrl}" />

          </head>
          <body>
            Wait to be redirected to the tiktok or <a href="${targetUrl}">click here</a>
          </body>
        </html>
      `.trim()
}

declare let base_url: string

// Create a new router
const router = Router()

router.get("/_video/*", async (req) => {
  const url = new URL(req.url, base_url)
  const videoRequest = url.pathname.replace(/^\/_video\//g, "")
  const redirectLocation = `https://v16-webapp.tiktok.com/${videoRequest.replace(
    ".mp4",
    "",
  )}/`
  console.log("Received a video request", redirectLocation)
  return Response.redirect(redirectLocation, 302)
})

const followShortenedLink = async (url: URL): Promise<string> => {
  console.log(`Following a short url!`)
  const redirectedUrl = `https://vm.tiktok.com${url.pathname}`
  console.log(redirectedUrl)
  const res = await fetch(redirectedUrl, {
    headers,
    method: "HEAD",
    redirect: "manual",
  })
  const newRedirect = res.headers.get("location")
  if (!newRedirect) {
    throw Error("Invalid redirect response")
  }
  const res2 = await fetch(newRedirect, {
    headers,
    method: "HEAD",
    redirect: "manual",
  })
  const lastStop = res2.headers.get("location")
  if (!lastStop) {
    throw Error("Invalid redirect response")
  }
  return lastStop
}

const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
}

function extractSigi(
  doc: HTMLElement,
  targetUrl: string,
): HTMLOptions | undefined {
  console.log(`Extracting SIGI site data`)
  const element = doc.querySelector("#sigi-persisted-data")
  if (!element) {
    return
  }
  const jsonString = element.textContent
    .replace(/^window\['SIGI_STATE'\]=/, "")
    .replace(/;window\['SIGI_RETRY'\].*$/, "")
  const data = JSON.parse(jsonString)
  const title = data.SEO.metaParams.title
  const item: any = Object.values(data.ItemModule)[0]
  if (!item) {
    console.log(`Got an ItemModule without any elements?`)
    return
  }
  const videoUrl = item.video.downloadAddr
  return {
    title,
    authorName: item.nickname,
    videoUrl,
    targetUrl,
  }
}
/*
Our index route, a simple hello world.
*/
router.get("*", async (req) => {
  console.log("requesting page")
  const selfUrl = new URL(req.url)
  console.log(selfUrl.toString())
  const path = selfUrl.pathname
  const isShortenedLink = selfUrl.hostname.startsWith("vm.")
  console.log(`Request ${isShortenedLink ? "is" : "is not"} a short url`)
  let targetUrl = isShortenedLink
    ? await followShortenedLink(selfUrl)
    : `https://www.tiktok.com${path}`

  const sanitizedUrl = new URL(targetUrl)
  sanitizedUrl.searchParams.forEach((param) => {
    sanitizedUrl.searchParams.delete(param)
  })
  console.log(sanitizedUrl)
  targetUrl = `${sanitizedUrl.protocol}//${sanitizedUrl.hostname}${sanitizedUrl.pathname}`

  //m.tiktok.com/v/7049346514459577646.html?_d=secCgwIARCbDRjEFSACKAESPgo8DNGHYzDkKMRJ%2Fu%2B4yKd22mv%2BIH4bR0HEki1JmUCvMv0XJcboWOsKyw6l3Hi%2B7QofmkVb1Eisk0as1I5oGgA%3D&checksum=8ec9dc56756f2e49c02d4915e6d59ed30764c1d1e376784dc0e2700482da0da0&language=en&preview_pb=0&sec_user_id=MS4wLjABAAAAUB5WfucN-53aAXHaiu-594vhVks9Xd68RJ_bBouZBjf0_DK_mZNUofnu4XnQjkBI&share_app_id=1233&share_item_id=7049346514459577646&share_link_id=FE07C427-4F94-4565-ACF7-DA6492687B7D&source=h5_m&timestamp=1641321091&tt_from=copy&u_code=41de7mj7j10el&user_id=89175694215155712&utm_campaign=client_share&utm_medium=ios&utm_source=copy
  // https: console.log(res)
  // return new Response(JSON.stringify(Object.fromEntries(res.headers.entries())))
  // }

  // if (!path.startsWith('/@') && !isShortenedLink) {
  //   return Response.redirect('https://github.com/Xetera/fixtiktok')
  // }
  const result = await fetch(targetUrl, { headers })
  const html = await result.text()
  const parsed = parser(html)
  const script = parsed.querySelector("script[id='__NEXT_DATA__']")
  let output: HTMLOptions | undefined
  if (!script) {
    output = extractSigi(parsed, targetUrl)
  }
  if (script) {
    const jsonLike = script!.innerText

    const data = JSON.parse(jsonLike).props.pageProps
    if (!("seoProps" in data)) {
      console.log(data)
    }
    // I don't know if this is a safe way of doing things but I feel like it should work
    const title = data.seoProps.metaParams.title
    const authorName = data.itemInfo.itemStruct.author.nickname

    output = {
      videoUrl: data.itemInfo.itemStruct.video.downloadAddr,
      authorName,
      targetUrl,
      title,
    }
  }

  if (output) {
    const html = generateHTML(selfUrl, output)
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
      },
    })
  } else {
    console.log("Couldn't find a script in the required destination")
  }

  return Response.redirect(targetUrl)
})

export async function handleRequest(request: Request): Promise<Response> {
  return router.handle(request)
}
