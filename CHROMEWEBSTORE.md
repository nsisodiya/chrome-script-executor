# Chrome Web Store Listing — Chrome Script Executor

> Last Updated: 2026-07-07

## Store Listing

**Extension Name**
Chrome Script Executor

**Short Description**
Capture user scripts and JSON data from one website and execute them on any other page with a custom payload.

**Detailed Description**
Chrome Script Executor is a powerful developer and power-user tool designed to bridge the gap between websites by letting you capture, store, and execute custom JavaScript scripts with associated JSON payloads across tabs.

Simulate integrations, inject custom DOM modifications, automate repetitious website tasks, and mock APIs on any destination page using stored scripts. The extension listens for a custom window event (`chrome-script-executor:capture`) containing the title, code, and JSON payload, displaying a secure, style-isolated confirmation box before saving.

**Key Features:**
- Secure Capture: Detects script payloads exported from any source webpage via custom events and prompts the user inside a Shadow DOM container.
- Match Recommendation: Recommends scripts based on the active tab's domain using wildcards.
- Context Toggle: Choose between running in the Isolated World (secure, CSP-safe) or the Page Context (to access window variables).
- In-Page Execution: Toggle an in-page floating launcher badge or slide out the script drawer (using `Alt+Shift+S`).
- Manual Scripting: Add, edit, or delete scripts, including live validation of associated JSON.
- Sandboxed Testbed: Included interactive dashboard to test capture events and verify execution.

**How to Use:**
1. Open a compatible script-exporting site or click "Launch Sandbox Testbed" in the popup footer.
2. Formulate a script and press "Share". Review and click "Approve & Save" in the slide-up confirmation card.
3. Navigate to your target website.
4. Click the extension toolbar icon or press `Alt+Shift+S` to open the launcher.
5. Click "Run" next to the script to execute it.

**Privacy Note:**
All scripts, JSON payloads, and preferences are stored exclusively on your device using Chrome's local extension storage. The extension does not collect or transmit any data off-device.

**Category**
Developer Tools

**Single Purpose**
Captures user scripts and JSON data from websites and executes them on other pages.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ⬜ Not created | |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 | 1280×800 or 640×400 | ⬜ Not created | |

### Screenshot Notes
- **Screenshot 1**: Injected confirmation drawer on the sandbox page showing a script being captured.
- **Screenshot 2**: Slide-out drawer panel open on a website (e.g. example.com) showing recommended scripts and execution results.
- **Screenshot 3**: Main Extension Popup dashboard showing the script list, settings checkbox, and editor view.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Required to save user-defined JavaScript code, JSON context payloads, and configuration settings locally on the device. |
| `tabs` | permissions | Required to identify the URL and title of the active tab, enabling the extension to match and recommend relevant scripts for the user's current site. |
| `scripting` | permissions | Required to inject and execute the saved JavaScript user scripts directly into the active tab's context when clicked by the user. |
| `<all_urls>` | host_permissions | Allows the user to execute saved scripts on any destination website they choose. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
https://github.com/nsisodiya/chrome-script-executor/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name**
Developer

**Contact Email**
developer@example.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-07-07 | Initial release. Capture flow, popup editor, in-page drawer, and interactive sandbox testbed. | Draft |

## Review Notes

### Known Issues / Limitations
- **Page Context execution**: Pages with very strict Content Security Policies that block `unsafe-eval` will reject scripts run in the `Page Context` (MAIN world). In these cases, users should run their scripts in the default `Isolated Context`, which completely bypasses the page's CSP.
