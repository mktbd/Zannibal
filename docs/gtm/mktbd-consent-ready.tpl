___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.


___INFO___

{
  "type": "TAG",
  "id": "cvt_temp_public_id",
  "version": 1,
  "securityGroups": [],
  "displayName": "mktbd consent ready",
  "brand": {
    "id": "brand_dummy",
    "displayName": "mktbd"
  },
  "description": "Pushes {event: 'mktbd_consent_ready'} after GTM's own consent state changes to granted for analytics_storage, ad_storage or ad_user_data. Fire on Consent Initialization - All Pages.",
  "containerContexts": [
    "WEB"
  ]
}


___TEMPLATE_PARAMETERS___

[]


___SANDBOXED_JS_FOR_WEB_TEMPLATE___

// mktbd consent ready (docs/MKTBD_SPEC.md, "Analytics (GTM)").
//
// CookieYes's GTM template only restores a stored choice; a banner click is
// applied by CookieYes's own script, outside the template APIs, and in
// production Preview tags on its cookie_consent_update event still saw
// "denied". addConsentListener runs when
// GTM's consent state itself changes, so an event pushed from here is
// queued after the change: tags on mktbd_consent_ready see the new state.
//
// - One event per consent update: Accept All changes several types at once;
//   the listeners only schedule a push, and callLater (after the current
//   code returns) sends it once. A later, separate grant (for example
//   advertising after analytics) sends another one.
// - Partial consent: the event says nothing about which type changed. Each
//   tag keeps its own consent requirement (GA4: analytics_storage; Meta:
//   ad_storage and ad_user_data), so an analytics-only choice never enables
//   Meta, nor an advertising-only choice GA4.
// - Duplicate hits: tags on this event fire Once per page, so a second
//   mktbd_consent_ready (or one after Initialization already fired them,
//   when a stored choice is restored on load) sends nothing more.
// - Withdrawal (granted -> denied) pushes nothing.
// - Fire on Consent Initialization - All Pages, the first trigger of every
//   page, so the listeners exist before any update is applied (CookieYes's
//   stored-choice update is applied after that event's tags finish).
const addConsentListener = require('addConsentListener');
const callLater = require('callLater');
const createQueue = require('createQueue');

const dataLayerPush = createQueue('dataLayer');
let scheduled = false;

const onConsentChange = (consentType, granted) => {
  if (!granted || scheduled) return;
  scheduled = true;
  callLater(() => {
    scheduled = false;
    dataLayerPush({ event: 'mktbd_consent_ready' });
  });
};

addConsentListener('analytics_storage', onConsentChange);
addConsentListener('ad_storage', onConsentChange);
addConsentListener('ad_user_data', onConsentChange);

data.gtmOnSuccess();


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "access_consent",
        "versionId": "1"
      },
      "param": [
        {
          "key": "consentTypes",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "analytics_storage"
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": false
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "ad_storage"
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": false
                  }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "consentType"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "ad_user_data"
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": false
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "access_globals",
        "versionId": "1"
      },
      "param": [
        {
          "key": "keys",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "key"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  },
                  {
                    "type": 1,
                    "string": "execute"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "dataLayer"
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": false
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]


___TESTS___

scenarios: []


___NOTES___

Custom template for GTM-TWW2NJKP. Import in Tag Manager: Templates -> Tag
Templates -> New -> menu -> Import. Tag: Consent Initialization - All Pages,
no consent requirement, exceptions Exclude - Admin and Exclude - non-mktbd
host. Sandboxed, so allowed by the site's gtm.allowlist (sandboxedScripts).
