## How to release a new version of the library
1. Update the version number in `package.json`
2. Run `npm install` to update the `package-lock.json` file
3. Commit your changes
4. Create a new tag with the version number and push it to the repository
5. Create a Release from the Tag on GitHub

## npm trusted publishing setup

Publishing uses GitHub Actions OIDC and does not require an npm access token. A package maintainer must configure the trusted publisher once in the settings for `@churchtools/churchtools-client` on npmjs.com:

- Provider: GitHub Actions
- Organization or user: `churchtools`
- Repository: `churchtools-js-client`
- Workflow filename: `npm-publish.yml`
- Environment: leave empty
- Allowed actions: `npm publish`

The values are case-sensitive. After a release has been published successfully through OIDC, set the package's publishing access to "Require two-factor authentication and disallow tokens", delete the unused `NPM_PUBLISH_TOKEN` GitHub Actions secret, and revoke its npm token.
