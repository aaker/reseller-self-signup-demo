const express = require('express')
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
var cors = require('cors');
const freeEmailDomains = require('./resources/free_domains.json')
const app = express()
app.use(express.json());
app.use(cors());
app.options('*', cors());
require('dotenv').config();

const nsApi = require('api')('@netsapiens-api/v2#9x0h26llbu2ac4');
nsApi.auth(process.env.NS_APIKEY);
nsApi.server("https://ns-api.com/ns-api/v2");

app.get('/', async (req, res) => {
    res.send(200, "ok");
            
});
app.post('/signup', async (req, res) => {
    const { email, name } = req.body; // Get the email and name from the request body
    const reseller = email.split('@')[1]; // Reseller will be their domain name
    const domain = email.split('@')[0] + "." + reseller;  // Domain will be their email name + their domain name
    const user = "1000" //Default user to create on domain. 
    const steps = [];
    if (freeEmailDomains.includes(reseller))
        return res.send({ status: "error", code: 403, message: "Please use your Business Email. " + reseller+ " is not allowed!", domain, reseller, steps });
    
    steps.push('Creating Reseller (' + reseller + ')');
    let proceed = true;
    const resellerData = await nsApi.CreateReseller({
        synchronous: "yes",
        reseller,
        description: "Reseller for " + reseller
    }).catch((err) => {
        if (err && err.status === 409) steps.push('Reseller already exists');
        else {
            console.log(err);
            res.send({ status: "error", code: err.data.code, message: err.data.message, domain, reseller, steps });
            return false;
        }
    });
    if (res.headersSent) return false;

    steps.push('Creating Domain (' + domain + ')');
    const domainData = await nsApi.CreateDomain({
        synchronous: "yes",
        domain,
        reseller,
        description: "Domain for " + name + " Testing",
        "email-send-from-address": "voicemail@netsapiens.com",
        "single-sign-on-enabled": "yes"
    }).catch((err) => {
        if (err && err.status === 409) steps.push('Domain already exists');
        else {
            res.send({ status: "error", code: err.data.code, message: err.data.message, domain, reseller, steps });
            return false;
        }
    });
    if (res.headersSent) return false;

    steps.push('Generating API Key with Reseller Scope');
    const apiKeyData = await nsApi.createApikey({
        description: "Reseller api key created for " + name + " for reseller " + reseller,
        reseller: reseller,
        domain: '*',
        scope: 'Reseller',
        readonly: 'no',
        can_create_keys: 'yes'
    }).catch((err) => {
        console.log(err);
        console.log(err.data);
        res.send({ status: "error", code: err.data.code, message: err.data.message, domain, reseller, steps });
        return false;
    });
    if (res.headersSent) return false;

    const key = apiKeyData.data.key;
    if (!key) {
        res.send({ status: "error", code: "No key returned", domain, reseller, steps });
        return false;
    }
    const key_url = postKeyToTempUrl(key,domain);
    
    steps.push('Success! Email will be sent (' + email + ') with secure link to API Key');

    if (sendEmail({email, key_url, name, reseller, domain}))
        steps.push('Email sent successfully');


    steps.push('Adding user ' + user + ' in ' + domain + ' with scope Reseller');
    const userData = await nsApi.CreateUser({
        synchronous: 'yes',
        "user": user,
        "email-address": email,
        "name-first-name": name.split(' ')[0],
        "name-last-name": name.split(' ')[1] || " ",
        'user-scope': 'Reseller',
        scope: 'Reseller'
    }, { domain }).catch((err) => {
        if (err && err.status === 409) steps.push('User already exists');
        else {
            res.send({ status: "error", code: err.data.code, message: err.data.message, domain, reseller, steps });
            return false;
        }
    });
    if (res.headersSent) return false;

    steps.push('Emailing welcome email to ' + email);
    proceed = await nsApi.SendEmail({
        "template": "welcome_email.php",
        "subject": "New Account Setup"
    }, { domain, user }).catch((err) => {
        console.log(err);
        return res.send({ status: "error", code: err.data.code, message: err.data.message, domain, reseller, steps });
    });

    steps.push("All Done!");
    
    if (!res.headersSent) res.send({ status: "ok", domain: domain, reseller: reseller, steps });

});

function postKeyToTempUrl(apikey,domain) {

    const hostname = "ns-api.com";
    const secret = Math.random().toString(36).substring(2, 15);
    const key = 'api_key'+domain;
    const timeout = 3600*24;

    axios.post("https://copypaste.netsapiens.com?hostname="+hostname+"&secret="+secret+"&key="+key+"&timeout="+timeout+"&value="+apikey) ;
    return "https://copypaste.netsapiens.com?hostname="+hostname+"&secret="+secret+"&key="+key;
}

async function sendEmail(args) {

    let html = fs.readFileSync('./resources/email.html', 'utf8');
    html = html.replace(/{name}/g, args.name);
    html = html.replace(/{reseller}/g, args.reseller);
    html = html.replace(/{domain}/g, args.domain);
    html = html.replace(/{key_url}/g, args.key_url);

    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    let mailOptions = {
        from: "engineering@netsapiens.com",
        to: args.email,
        cc: "ns-api@crexendo.com",
        subject: "Developer Sandbox Access",
        text: "Your api key is available at " + args.key_url,
        html
    }

    try {
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.error(error);
            } 
            if (info) {
                console.log(info);
            } 
        });
    } catch (error) {

        console.log("Error sending email: " + error);
        return false;
    }
    return true;

}


app.listen(3295, () => {
    console.log(`Example app listening on port 3295`);
});