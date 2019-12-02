const http = require('http');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const keyBy = require('lodash.keyby');
const omit = require('lodash.omit');
const mapValues = require('lodash.mapvalues');

// load .env config
require('dotenv').config();

// create Slack events adapter with body data and headers
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret, {
  includeBody: true,
  includeHeaders: true,
});

// create Slack web client
const slack = new WebClient(process.env.SLACK_ACCESS_TOKEN);

// add link_shared Slack event handler
slackEvents.on('link_shared', (event, body, headers) => {
  console.log(`\nlinks shared event: \n\tfrom user: ${event.user} in channel: ${event.channel}`);
  console.log(`\tevent id: ${body.event_id} event time: ${body.event_time}`);
  if (headers['X-Slack-Retry-Num'] !== undefined) {
    console.log(`event delivery was retried ${headers['X-Slack-Retry-Num']} times \
      because ${headers['X-Slack-Retry-Reason']}`);
  }
  console.log('\tlinks:');
  console.dir(event.links);

  // transform vs marketplace links to unfurled attachments
  Promise.all(event.links.map(getLinkInfo))
    // transform expended link info to unfurls keyed by url
    .then(attachments => keyBy(attachments, 'url'))
    .then(unfurls => mapValues(unfurls, attachment => omit(attachment, 'url')))
    // send unfurled link attachments to Slack
    .then(unfurls => slack.apiCall('chat.unfurl', {
        channel: event.channel,
        ts: event.message_ts, 
        unfurls: unfurls
      }))
    .catch(console.error);
});

// add generic Slack events error handler
slackEvents.on('error', (error) => {
  console.log(error);
});

// start built-in Slack events http server
(async () => {
  const port = process.env.PORT || 3000;
  const server = await slackEvents.start(port);
  console.log(`Listening for events on port: ${server.address().port}`);
})();

/**
 * Creates VS marketplace link unfurl message attachment info.
 * @param link VS marketplace link to unfurl
 */
function getLinkInfo(link) {
  // create initial unfurl link info
  const linkInfo = {
    "color": "#36a64f",
    "title": link.url,
    "title_link": link.url,
    "footer": "VS Marketplace",
    url: link.url
  };

  // TODO: get vs marketplace info and generate unfurled link info message attachment
  // with ext. name, author, installs, downloads, ext. icon, links to repo, issues, etc.
  // for the vs ext. link. Otherwise, use generic https://marketplace.visualstudio.com/ 
  // page headers instead ...

  return linkInfo;
}
