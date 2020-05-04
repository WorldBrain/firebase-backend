import * as functions from 'firebase-functions'
import { Request} from 'firebase-functions/lib/providers/https'
import * as express from "express";
const fetch = require('node-fetch');

const appKey = functions.config().countly['app_key']

export const uninstall = functions.https.onRequest(async (req: Request, resp: express.Response) => {

    const user = req.query.user
    const events = JSON.stringify({
        "key": "Global::uninstallExtension",
        "count": 1
    })
    const urlbase = 'https://analytics.worldbrain.io/i'
    const urlParams = `${urlbase}?app_key=${appKey}&device_id=${user}&events=${events}`;
    const url = `${urlbase}?${urlParams}`

    console.log(`Logging uninstall event: ${url}`)
    await fetch(url)
    resp.redirect(`https://worldbrain.io/uninstall/?user=${user}`)
})
