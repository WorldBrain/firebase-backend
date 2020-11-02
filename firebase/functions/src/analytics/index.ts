import * as functions from 'firebase-functions'
import { Request} from 'firebase-functions/lib/providers/https'
import * as express from "express";
const fetch = require('node-fetch');

const config = functions.config();
const appKey = config.countly['app_key']
const appDomain = config.countly['app_domain']


const redirectUrl = "https://airtable.com/shrZ987GUsOWWMH7L"

export const uninstall = functions.https.onRequest(async (req: Request, resp: express.Response) => {
    let backgroundFunctionUrl = `https://${req.hostname}/uninstallLog?user=${ req.query.user}`
    // console.log(`Calling uninstall event: ${backgroundFunctionUrl}`)
    fetch(backgroundFunctionUrl)
    resp.redirect(redirectUrl)
})

export const uninstallLog = functions.https.onRequest(async (req: Request, resp: express.Response) => {

    const user = req.query.user
    const events = JSON.stringify({
        "key": "Global::uninstallExtension",
        "count": 1
    })
    const analyticsUrl = `https://${appDomain}/i?app_key=${appKey}&device_id=${user}&events=${events}`;
    await fetch(analyticsUrl)
    console.log(`Logged uninstall event: ${analyticsUrl}`)
    resp.send('Done')
})
