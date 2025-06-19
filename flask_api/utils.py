import os
import zipfile
import pandas as pd
import requests
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import numpy as np
from features import extract_features
from urllib.parse import urlparse

def download_top_sites(limit=10863):
    print("🌐 Downloading top legitimate URLs (Cisco Umbrella Top 1M)...")
    url = "http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip"
    datasets_dir = "datasets"
    zip_path = os.path.join(datasets_dir, "top-1m.csv.zip")
    csv_path = os.path.join(datasets_dir, "top-1m.csv")

    os.makedirs(datasets_dir, exist_ok=True)

    try:
        response = requests.get(url)
        with open(zip_path, "wb") as f:
            f.write(response.content)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(datasets_dir)

        df_top = pd.read_csv(csv_path, header=None, names=["rank", "domain"])
        legit_urls = ["https://" + domain for domain in df_top["domain"].head(limit)]
        return legit_urls
    except Exception as e:
        print("❌ Error downloading/extracting top sites:", e)
        return []

def load_phishing_from_csv(path="datasets/verified_online.csv", limit=12000):
    print(f"📥 Loading phishing URLs from {path}...")
    try:
        df = pd.read_csv(path)
        df = df[['url']].dropna()
        return df.head(limit)['url'].tolist()
    except Exception as e:
        print("❌ Error reading phishing URLs from CSV:", e)
        return []

def load_manual_legit_urls(path="datasets/manual_legit_urls.txt"):
    print(f"📖 Loading manually verified legit URLs from {path}...")
    try:
        with open(path, "r") as f:
            urls = [line.strip() for line in f if line.strip()]
        return urls
    except Exception as e:
        print("❌ Error reading manual legit URLs:", e)
        return []

def is_url_in_manual_legit(url, manual_legit_urls):
    try:
        domain = urlparse(url).netloc.lower()
        for legit_url in manual_legit_urls:
            legit_domain = urlparse(legit_url).netloc.lower()
            if domain == legit_domain or domain.endswith("." + legit_domain):
                return True
        return False
    except:
        return False

def train_model():
    phishing_urls = load_phishing_from_csv(limit=12000)
    df_phish = pd.DataFrame({'url': phishing_urls, 'label': 1})

    legit_urls = download_top_sites(limit=10863)
    manual_legit_urls = load_manual_legit_urls()
    all_legit_urls = legit_urls + manual_legit_urls
    df_legit = pd.DataFrame({'url': all_legit_urls, 'label': 0})

    df = pd.concat([df_phish, df_legit], ignore_index=True)

    # Override label = 0 for URLs in manual legit whitelist
    df['label'] = df.apply(
        lambda row: 0 if is_url_in_manual_legit(row['url'], manual_legit_urls) else row['label'],
        axis=1
    )

    df = df.sample(frac=1).reset_index(drop=True)  # Shuffle

    print(f"📊 Total URLs: {len(df)} (Phishing: {len(df_phish)}, Legitimate: {len(df_legit)})")

    print("🔍 Extracting features...")
    df['features'] = df['url'].apply(lambda u: extract_features(u))
    X = list(df['features'])
    y = df['label']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("🧠 Training Random Forest model...")
    clf = RandomForestClassifier(n_estimators=150, max_depth=12, random_state=42)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    print("\n📈 Model Evaluation on Test Data:")
    print(classification_report(y_test, y_pred))

    importances = clf.feature_importances_
    indices = np.argsort(importances)[::-1]

    print("\n⭐ Feature importances (descending):")
    for i in indices:
        print(f"Feature {i}: {importances[i]:.4f}")

    os.makedirs("model", exist_ok=True)
    joblib.dump(clf, 'model/phishing_model.pkl')
    print("✅ Model trained and saved to model/phishing_model.pkl")

if __name__ == "__main__":
    train_model()
