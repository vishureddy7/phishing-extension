// email_content_script.js
// NO IMPORT STATEMENT HERE - manual_legit_urls_content.js will load it as a global

console.log("PhishyBiz Email content script loaded");

// Access legitUrls from the global window object.
// It's guaranteed to be loaded because manual_legit_urls_content.js is listed before this script in manifest.json.
const legitUrls = window.legitUrls || []; // Provide a fallback just in case

// ---

// Utility: Extract unique URLs from text
function extractUrls(text) {
  return Array.from(new Set(text.match(/\bhttps?:\/\/[^\s<>"']+/gi) || []));
}

// Get the domain (hostname) from a URL
function getDomain(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '').toLowerCase(); // normalize: remove 'www.' and convert to lowercase
  } catch {
    return null; // Return null if URL is invalid (e.g., malformed)
  }
}

// This normalizeUrl function is not directly used in the domain-based
// isUrlWhitelisted, but can be kept for other purposes if needed.
function normalizeUrl(url) {
  return url.replace(/\/+$/, ''); // strip trailing slashes
}

// isUrlWhitelisted function checks if a URL's domain is in the legitUrls whitelist.
function isUrlWhitelisted(url) {
  try {
    const urlDomain = getDomain(url);
    if (!urlDomain) {
      return false; // If the URL is malformed and we can't get a domain, it's not whitelisted.
    }

    // Check if the URL's domain matches any domain in the legitUrls list
    return legitUrls.some(whitelistUrlEntry => {
      const whitelistDomain = getDomain(whitelistUrlEntry);
      // Both domains must be valid and must exactly match
      return whitelistDomain && urlDomain === whitelistDomain;
    });
  } catch (err) {
    console.error("Error in isUrlWhitelisted:", err); // Log any unexpected errors
    return false;
  }
}


// Tries to find the visible email body from Gmail
function getOpenedEmailBody() {
  const allBodies = document.querySelectorAll('div.a3s');
  for (const body of allBodies) {
    // Check for visibility (offsetParent !== null) and ensure it has content
    if (body.offsetParent !== null && body.innerText && body.innerText.trim().length > 0) {
      return body.innerText;
    }
  }
  return null;
}

// Create and show popup inside Gmail page
function showPopup(results) {
  console.log("Showing popup with results:", results);

  // Remove any existing popup to avoid duplicates
  const oldPopup = document.getElementById('phishybiz-popup');
  if (oldPopup) oldPopup.remove();

  const popup = document.createElement('div');
  popup.id = 'phishybiz-popup';
  popup.style.position = 'fixed';
  popup.style.bottom = '20px';
  popup.style.right = '20px';
  popup.style.backgroundColor = '#1d1d1d';
  popup.style.color = 'white';
  popup.style.padding = '15px';
  popup.style.borderRadius = '8px';
  popup.style.boxShadow = '0 2px 12px rgba(0,0,0,0.5)';
  popup.style.zIndex = '999999999';
  popup.style.maxWidth = '350px';
  popup.style.fontFamily = 'Arial, sans-serif';
  popup.style.fontSize = '14px';

  const title = document.createElement('div');
  title.textContent = 'PhishyBiz - Email Scan Results';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  popup.appendChild(title);

  // Add each result line to the popup
  results.forEach(line => {
    const p = document.createElement('p');
    p.style.margin = '4px 0';
    p.textContent = line;
    popup.appendChild(p);
  });

  // Add a close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '10px';
  closeBtn.style.padding = '6px 10px';
  closeBtn.style.border = 'none';
  closeBtn.style.backgroundColor = '#444';
  closeBtn.style.color = 'white';
  closeBtn.style.borderRadius = '4px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => popup.remove();
  popup.appendChild(closeBtn);

  document.body.appendChild(popup);
  // Auto-hide the popup after 15 seconds
  setTimeout(() => popup.remove(), 15000);
}

// Calls Flask API to scan each URL (will now scan all URLs unless whitelisted)
async function scanEmailUrls(urls) {
  const results = [];

  for (const url of urls) {
    // Re-added check for whitelisted URLs, but now explicitly sets 0% probability
    if (isUrlWhitelisted(url)) {
      results.push(`${url} → ✅ Safe (Phishing Probability:0.00%)`);
      continue; // Skip API call for whitelisted URLs
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        results.push(`${url} → ⚠️ Error checking URL (Status: ${response.status})`);
        continue;
      }

      const data = await response.json();
      // Ensure data.confidence is a number and format it
      const confidence = (Number(data.confidence || 0) * 100).toFixed(2);
      const verdict = data.phishing ? "⚠️ Phishing" : "✅ Safe"; // Keep original verdict text

      results.push(`${url} → ${verdict} (Phishing Probability: ${confidence}%)`);
    } catch (err) {
      results.push(`${url} → ⚠️ Error during scanning: ${err.message}`);
    }
  }

  return results;
}

// Prevents scanning the same email content repeatedly
let lastEmailBodyText = '';

// Main function to handle email content changes and trigger scans
async function handleEmailChange() {
  const emailBodyText = getOpenedEmailBody();

  // If no email body found, or if it's the same as the last one, do nothing
  if (!emailBodyText || emailBodyText === lastEmailBodyText) {
    return;
  }
  lastEmailBodyText = emailBodyText; // Update the last scanned content

  const urls = extractUrls(emailBodyText);
  if (urls.length === 0) {
    showPopup(["No URLs found in this email."]);
    return;
  }

  showPopup(["Scanning email for phishing URLs..."]);

  const scanResults = await scanEmailUrls(urls);
  showPopup(scanResults);
}

// Observe URL changes (e.g., navigating between emails or different Gmail views)
let lastUrl = location.href;

new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // Debounce the handler to allow Gmail to fully render content after navigation
    setTimeout(handleEmailChange, 1500);
  } else {
    // Also trigger if the URL hasn't changed but the content within the email view might have (e.g., opening a new email in the same view)
    handleEmailChange();
  }
}).observe(document.body, { subtree: true, childList: true });