# Official provider quota connection

Only the existing admin endpoint can read these reports. Authentication is rechecked through the existing Supabase player_status RPC. Secrets never belong in a browser request, source file, GitHub commit, or returned report.

Worker secrets:
- CLOUDFLARE_QUOTA_TOKEN: Account Analytics Read, account d89184d96d606cf21e6593474488a452, expires 2027-01-06. Revoke/rotate from Cloudflare Account API tokens; replace the Worker secret before expiry.
- GOOGLE_QUOTA_SERVICE_ACCOUNT: JSON service account credential for aoi-quota-reader@gen-lang-client-0388317824.iam.gserviceaccount.com. Project role is Monitoring Viewer only. OAuth tokens use monitoring.read and expire in one hour; the Worker refreshes them automatically. Rotate/revoke the service account key in Google IAM and replace the Worker secret.

Google uses the actual project's free-tier request metrics:
- generativelanguage.googleapis.com/quota/generate_content_free_tier_requests/limit
- generativelanguage.googleapis.com/quota/generate_content_free_tier_requests/usage
- limit_name = GenerateRequestsPerDayPerProjectPerModel-FreeTier

The observed usage metric is DELTA/INT64, so daily usage sums its intervals after America/Los_Angeles midnight across the project, separately per model. Minute quota usage is not added. Duplicated regional limits are not summed. Missing metrics, incomplete pages and intervals crossing midnight are reported as unavailable, never invented zero usage.

Cloudflare queries the account GraphQL aiInferenceAdaptiveGroups totalNeurons without limiting to a model or a Worker. Day starts at UTC midnight. The official Analytics dataset may be sampled/delayed; remaining = 10000 - reported Neurons is an official account usage calculation, not a hard real-time guarantee. The site 8500-Neuron protective budget stays separate.

Results cache for 60 seconds, invalidated at either provider day boundary. Failure reports hide raw diagnostics and credentials. No billing, tier, original Gemini secret, player usage counter or global question cap is changed.
