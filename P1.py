import base64
import io
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image
import tensorflow as tf

app = Flask(__name__, static_folder='static', static_url_path='')

# to match the order used in training
CLASS_NAMES = ['circle', 'square', 'triangle', 'hexagon', 'octagon']

# load the model with custom compile options
model = tf.keras.models.load_model("Models/shapes_model.keras", compile=False)
model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json.get('image', None)
        if not data:
            return jsonify({"error": "No image data provided"}), 400
        
        if "," in data:
            data = data.split(",")[1]
        image_data = base64.b64decode(data)
        
        # load and preprocess img for prediction
        img = Image.open(io.BytesIO(image_data)).convert('L')
        img = img.resize((28, 28), Image.Resampling.LANCZOS)
        
        # normalize
        img_arr = np.array(img).astype('float32') / 255.0
        
        # invert colors 
        img_arr = 1.0 - img_arr
        
        # reshape and add channel dimension
        img_arr = img_arr.reshape(1, 28, 28, 1)

        # prediction with higher confidence threshold
        preds = model.predict(img_arr, verbose=0)
        
        #top 2 predictions for confidence comparison
        top_2_idx = np.argsort(preds[0])[-2:][::-1]
        
        class_idx = top_2_idx[0]
        confidence = float(preds[0][class_idx])
        predicted_class = CLASS_NAMES[class_idx]
        
        # all probabilities 
        probabilities = {name: float(prob) for name, prob in zip(CLASS_NAMES, preds[0])}
        
        return jsonify({
            "prediction": predicted_class,
            "confidence": confidence,
            "probabilities": probabilities
        })
    
    except Exception as e:
        print("Error making prediction:", str(e))
        return jsonify({"error": "Error making prediction: " + str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)