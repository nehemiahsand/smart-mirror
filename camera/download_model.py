#!/usr/bin/env python3
"""
Download MobileNet SSD model files for person detection
"""
import os
import urllib.request

MODEL_DIR = "/app/models"
os.makedirs(MODEL_DIR, exist_ok=True)

# OpenCV's pre-trained MobileNet SSD from official repository
PROTOTXT_URL = "https://github.com/opencv/opencv/raw/master/samples/dnn/face_detector/deploy.prototxt"
# Use COCO MobileNet SSD model
FROZEN_MODEL_URL = "http://download.tensorflow.org/models/object_detection/ssd_mobilenet_v2_coco_2018_03_29.tar.gz"

# Simpler: Use OpenCV's built-in Caffe models
PROTOTXT_URL = "https://raw.githubusercontent.com/djmv/MobilNet_SSD_opencv/master/MobileNetSSD_deploy.prototxt"
CAFFEMODEL_URL = "https://github.com/djmv/MobilNet_SSD_opencv/raw/master/MobileNetSSD_deploy.caffemodel"

PROTOTXT_PATH = os.path.join(MODEL_DIR, "MobileNetSSD_deploy.prototxt")
CAFFEMODEL_PATH = os.path.join(MODEL_DIR, "MobileNetSSD_deploy.caffemodel")

def download_file(url, dest_path):
    """Download file if it doesn't exist"""
    if os.path.exists(dest_path):
        print(f"✓ {dest_path} already exists")
        return
    
    print(f"Downloading {url}...")
    try:
        urllib.request.urlretrieve(url, dest_path)
        print(f"✓ Downloaded to {dest_path}")
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        raise

if __name__ == "__main__":
    print("Downloading MobileNet SSD model files...")
    download_file(PROTOTXT_URL, PROTOTXT_PATH)
    download_file(CAFFEMODEL_URL, CAFFEMODEL_PATH)
    print("\n✓ Model download complete!")
