const functions = require('firebase-functions');
import {UserRecord} from "firebase-functions/lib/providers/auth";

const apiKey = functions.config().elasticemail.api_key
const defaultTemplateId = "18692"
const template = functions.config().elasticemail.template || defaultTemplateId

export const sendWelcomeEmailOnSignUp = functions.auth.user().onCreate(
    async (user: UserRecord) => {
        const axios = require('axios').default;
        var querystring = require('querystring');

        const data = {
            apiKey,
            template,
            to: user.email,
            from: "oli@worldbrain.io"
        };
        console.log(`Welcome email sending`); // with data: ${JSON.stringify(data)}
        const emailResult = await axios.post('https://api.elasticemail.com/v2/email/send', querystring.stringify(data),);
        console.log(`Welcome email sent with result:${JSON.stringify(emailResult.data)}`)
        return ;
    }
);

