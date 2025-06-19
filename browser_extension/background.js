import { isPhishingDomain } from "./dns_filter.js";
import { legitUrls } from "./manual_legit_urls_background.js"; // *** CHANGED IMPORT PATH ***

/**
 * Injects a popup message into the specified tab.
 * This function is executed in the context of the content script.
 * @param {number} tabId - The ID of the tab to inject the script into.
 * @param {string} message - The message to display in the popup.
 * @param {string} bgColor - The background color of the popup.
 */
function injectPopup(tabId, message, bgColor) {
  chrome.scripting.executeScript({
    target: { tabId },
    function: (msg, color) => {
      // Remove any existing popup to avoid duplicates
      let existing = document.getElementById('phishing-popup');
      if (existing) existing.remove();

      // Create and style the popup element
      const popup = document.createElement('div');
      popup.id = 'phishing-popup';
      popup.style.position = 'fixed';
      popup.style.top = '20px';
      popup.style.right = '20px';
      popup.style.padding = '15px 20px';
      popup.style.backgroundColor = color;
      popup.style.color = '#fff';
      popup.style.fontSize = '16px';
      popup.style.fontWeight = 'bold';
      popup.style.borderRadius = '8px';
      popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      popup.style.zIndex = 999999;
      popup.style.cursor = 'pointer';
      popup.style.maxWidth = '350px';
      popup.style.fontFamily = 'Arial, sans-serif';
      popup.style.whiteSpace = 'pre-line'; // Allows newlines in the message

      popup.textContent = msg;
      popup.onclick = () => popup.remove(); // Remove popup on click

      document.body.appendChild(popup);

      // Automatically remove popup after 10 seconds
      setTimeout(() => {
        popup.remove();
      }, 10000);
    },
    args: [message, bgColor] // Arguments passed to the injected function
  });
}

/**
 * Extracts the main domain (hostname) from a given URL.
 * Removes 'www.' and converts to lowercase for consistent comparison.
 * @param {string} url - The URL string.
 * @returns {string|null} The normalized domain or null if the URL is invalid.
 */
function getDomain(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    console.error(`Failed to get domain for URL: ${url}`, e);
    return null;
  }
}

/**
 * Checks if a given URL's domain is present in the `legitUrls` whitelist.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the URL's domain is whitelisted, false otherwise.
 */
function isUrlWhitelisted(url) {
  const urlDomain = getDomain(url);
  if (!urlDomain) {
    return false; // Cannot get domain from URL
  }

  // Iterate through the legitUrls and check if any of their domains match the URL's domain
  return legitUrls.some(whitelistUrlEntry => {
    const whitelistDomain = getDomain(whitelistUrlEntry);
    return whitelistDomain && urlDomain === whitelistDomain;
  });
}

// Listen for messages from content scripts (e.g., email_content_script.js)
chrome.runtime.onMessage.addListener((request, sender) => {
  // Ensure the message originated from a tab
  if (!sender.tab || !sender.tab.id) {
    console.warn("Message received without a valid tab ID from sender.");
    return;
  }

  // Handle email scan start notification
  if (request.type === "emailScanStarted") {
    injectPopup(sender.tab.id, "🔍 Scanning email URLs for phishing...", "#1a73e8"); // Blue popup
  }

  // Handle email scan results notification
  if (request.type === "emailScanResults") {
    let phishingCount = 0;
    // Count how many results lines indicate phishing
    for (const line of request.results) {
      if (line.includes("Phishing")) {
        phishingCount++;
      }
    }

    let message, bgColor;
    if (phishingCount > 0) {
      message = `🚨 Email Scan: ${phishingCount} phishing link(s) detected!`;
      bgColor = "#d93025"; // Red for warnings
    } else {
      message = "✅ Email Scan: No phishing links found in email.";
      bgColor = "#188038"; // Green for safe
    }

    injectPopup(sender.tab.id, message, bgColor);
  }
});

// Handle normal tab URL updates for overall phishing detection
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only proceed when the tab has finished loading and has a URL
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  // Ignore internal Chrome pages, extension pages, and Google Search results
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("https://www.google.com/search")
  ) {
    return;
  }

  // Ignore Gmail specific email reading pages (URLs containing '#') to avoid double-scanning
  // by this background script, as the content script handles these.
  // However, allow initial Gmail inbox URLs to be scanned by this script.
  if (
    tab.url.startsWith("https://mail.google.com/mail/u/") &&
    tab.url.includes("#")
  ) {
    return;
  }

  // Check if the URL's domain is whitelisted
  if (isUrlWhitelisted(tab.url)) {
    injectPopup(
      tabId,
      `✅ This website appears to be genuine.\nPhishing Probability: 0.00%`,
      "#188038"
    );
    return; // Stop further checks if whitelisted
  }

  let domain;
  try {
    domain = new URL(tab.url).hostname;
  } catch (e) {
    console.error(`Invalid URL encountered: ${tab.url}`, e);
    return; // Skip if URL is malformed
  }

  // DNS Filtering: show warning popup if it's a known phishing domain
  if (isPhishingDomain(domain)) {
    injectPopup(tabId, "⚠️ DNS Filter: Known phishing domain!", "#d93025");
    return; // Stop further checks if caught by DNS filter
  }

  // AI-based phishing analysis by calling Flask API
  fetch("http://127.0.0.1:5000/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: tab.url }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`API response not OK: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      const rawConfidence = Number(data.confidence ?? 0);
      const confidencePercent = (rawConfidence * 100).toFixed(2);

      if (data.phishing === true) {
        injectPopup(
          tabId,
          `🚨 AI Warning: This site may be phishing!\nPhishing Probability: ${confidencePercent}%`,
          "#d93025" // Red for phishing
        );
      } else {
        injectPopup(
          tabId,
          `✅ This website appears to be genuine.\nPhishing Probability: ${confidencePercent}%`,
          "#188038" // Green for safe
        );
      }
    })
    .catch((error) => {
      console.error("Error calling Flask API for URL scan:", error);
      // Optionally inject a popup for API errors
      injectPopup(tabId, "❌ Error scanning URL: Please check API server.", "#d93025");
    });
});
