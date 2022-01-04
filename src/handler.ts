import { Router } from 'itty-router'
import parser from 'node-html-parser'

declare let base_url: string

// Create a new router
const router = Router()

router.get('/_video/*', async (req) => {
  const url = new URL(req.url, base_url)
  const videoRequest = url.pathname.replace(/^\/_video\//g, '')
  const redirectLocation = `https://v16-webapp.tiktok.com/${videoRequest.replace(
    '.mp4',
    '',
  )}/`
  console.log('Received a video request', redirectLocation)
  return Response.redirect(redirectLocation, 302)
})

/*
Our index route, a simple hello world.
*/
router.get('*', async (req) => {
  console.log('requesting page')
  const selfUrl = new URL(req.url)
  const path = selfUrl.pathname
  if (!path.startsWith('/@')) {
    return new Response(null, { status: 404 })
  }
  const targetUrl = `https://www.tiktok.com${path}`
  console.log(targetUrl)
  const result = await fetch(targetUrl, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    },
  })
  const html = await result.text()
  const parsed = parser(html)
  const script = parsed.querySelector("script[id='__NEXT_DATA__']")
  if (script) {
    const jsonLike = script.innerText
      .replace(/^window\['SIGI_STATE'\]=/, '')
      .replace(/;window\['SIGI_RETRY'\].*$/, '')

    const data = JSON.parse(jsonLike).props.pageProps
    // console.log(data);
    if (!('seoProps' in data)) {
      console.log(data)
    }
    // I don't know if this is a safe way of doing things but I feel like it should work
    const title = data.seoProps.metaParams.title
    const authorName = data.itemInfo.itemStruct.author.nickname

    const urlPath = new URL(data.itemInfo.itemStruct.video.downloadAddr)
    const urlFragment = urlPath.pathname.replace(/\/$/, '') + '.mp4'
    const url = `${selfUrl.protocol}//${selfUrl.hostname}/_video${urlFragment}`
    console.log(url)
    const writeResponse = `
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
    console.log(writeResponse)
    return new Response(writeResponse, {
      headers: {
        'content-type': 'text/html; charset=UTF-8',
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
