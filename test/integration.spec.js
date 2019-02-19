const handler = require('../index').handler;

(async (evt) => {
    const res = await handler(evt);
    console.log(res);
})({});
