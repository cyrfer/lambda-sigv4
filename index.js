const got = require('got');
const sigv4 = require('sigv4');
const AWS = require('aws-sdk');

const config = {
    roleArn: process.env.ROLE_ARN,
    request: {
        url: process.env.URL,
    },
    signing: {
        // region target needed when signing
        region: process.env.TARGET_AWS_REGION,
        // lambda environment could provide credentials for signing
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        token: process.env.AWS_SESSION_TOKEN,
    }
}

const stsToSigv4 = (creds) => {
    return {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretAccessKey,
        token: creds.SessionToken,
        region: config.signing.region,
    }
}

const assumeRole = ({sts}, roleArn) => {
    return new Promise((resolve, reject) => {
        const params = {
            DurationSeconds: 3600, 
            RoleArn: roleArn,
            RoleSessionName: "cross-account-lambda-test"
        };
        sts.assumeRole(params, (err, data) => {
            if (err) {
                console.error(JSON.stringify(err));
                return reject(err);
            }
            resolve(stsToSigv4(data.Credentials || {}));
        });
    });
};

const initServices = () => {
    return {
        sts: new AWS.STS({region: config.signing.region}),
    }
}

let services;

exports.handler = async (event, context) => {
    if (!services) {
        services = initServices();
    }

    return (config.roleArn ? assumeRole(services, config.roleArn) : Promise.resolve(config.signing))
    .then(creds => {
        const signed = sigv4(config.request, creds);
        return got(config.request.url, {
            headers: signed.headers,
        })
    })
    .then(res => {
        return {
            statusCode: res.statusCode,
            body: res.body,
        };
    })
    .catch(exc => {
        console.error('exc', exc);
        throw exc;
    })
};
