# Privacy Policy (LLM Translator Render)

Last updated: 2026-03-05

## What data is processed
- Web page article text selected for translation
- Extension settings (provider, model, mode, excluded domains)
- Authentication data (API key or OAuth token, when configured)

## How data is used
- Article text is sent to your configured LLM provider only to perform translation.
- Settings and cache are stored locally in Chrome storage.
- No third-party analytics or ad SDK is used.

## Data sharing
- Data is shared only with the LLM endpoint configured by the user.
- We do not operate a separate telemetry backend in this project.

## User controls
- You can clear cache in Options.
- You can log out OAuth in Options.
- You can disable translation on specific domains via excluded domain settings.

## Security notes
- Content scripts do not directly access secrets; translation requests are mediated by the background worker.
- HTTPS endpoints are enforced (except localhost/127.0.0.1 for local development).

## Contact
- Repository: https://github.com/kochangbok/translator-render
