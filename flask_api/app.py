print("Starting app.py")

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
from features import extract_features

app = Flask(__name__)
CORS(app)  # <-- Added this

print("Loading model...")
model = joblib.load('model/phishing_model.pkl')
print("Model loaded!")

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    url = data.get('url')
    if not url:
        return jsonify({'error': 'Missing URL'}), 400

    features = extract_features(url)
    prediction = model.predict([features])[0]
    probability = model.predict_proba([features])[0][1]

    return jsonify({
        'phishing': bool(prediction),
        'confidence': round(probability, 2)
    })

if __name__ == '__main__':
    print("Running Flask app...")
    app.run(port=5000, debug=True)
