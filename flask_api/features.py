import re
from urllib.parse import urlparse

def count_digits(s):
    return sum(c.isdigit() for c in s)

def count_special_chars(s):
    return len(re.findall(r'[^a-zA-Z0-9\-./:?&=]', s))

def has_ip_address(domain):
    return 1 if re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", domain) else 0

def count_subdomains(domain):
    if domain.startswith("www."):
        domain = domain[4:]
    return domain.count('.')

def has_https_scheme(scheme):
    return 1 if scheme == "https" else 0

def has_at_symbol(url):
    return 1 if "@" in url else 0

def url_length(url):
    return len(url)

def count_hyphens(domain):
    return domain.count('-')

def count_query_params(parsed_url):
    return parsed_url.query.count('&') + 1 if parsed_url.query else 0

def count_fragments(parsed_url):
    return 1 if parsed_url.fragment else 0

def has_redirect(url):
    return 1 if url[8:].find("//") != -1 else 0  # Skip scheme part

def count_path_tokens(path):
    return len([token for token in path.split('/') if token])

def count_numeric_subdomain(domain):
    parts = domain.split('.')
    return sum(part.isdigit() for part in parts)

def has_suspicious_tld(domain):
    suspicious_tlds = ["zip", "review", "country", "stream", "biz", "xyz"]
    return 1 if domain.split('.')[-1] in suspicious_tlds else 0

def extract_features(url):
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    scheme = parsed.scheme.lower()
    path = parsed.path

    features = [
        url_length(url),
        count_digits(url),
        count_special_chars(url),
        has_ip_address(domain),
        count_subdomains(domain),
        has_https_scheme(scheme),
        has_at_symbol(url),
        count_hyphens(domain),
        count_query_params(parsed),
        count_fragments(parsed),
        has_redirect(url),
        count_path_tokens(path),
        count_numeric_subdomain(domain),
        has_suspicious_tld(domain)
    ]

    return features
