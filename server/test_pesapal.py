import requests
import urllib.parse
import json

def test_pesapal_auth():
    consumer_key = "zXEfhXBRIRLnlMk3ZmC+H61wYJFQZc2t"
    consumer_secret = "Qr84lZLHFur6sOPMc2oKPrxrh60="
    
    print("Testing Pesapal authentication...")
    print(f"Consumer Key: {consumer_key}")
    print(f"Consumer Secret: {consumer_secret}")
    
    # Test 1: Raw credentials as JSON
    print("\n1. Testing raw credentials as JSON:")
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    payload = {'consumer_key': consumer_key, 'consumer_secret': consumer_secret}
    
    try:
        response = requests.post(
            'https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken',
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: URL encoded credentials as JSON
    print("\n2. Testing URL encoded credentials as JSON:")
    key_encoded = urllib.parse.quote(consumer_key, safe='')
    secret_encoded = urllib.parse.quote(consumer_secret, safe='')
    payload = {'consumer_key': key_encoded, 'consumer_secret': secret_encoded}
    
    try:
        response = requests.post(
            'https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken',
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: As form data
    print("\n3. Testing as form data:")
    headers = {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'}
    form_data = f'consumer_key={urllib.parse.quote(consumer_key)}&consumer_secret={urllib.parse.quote(consumer_secret)}'
    
    try:
        response = requests.post(
            'https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken',
            data=form_data,
            headers=headers,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_pesapal_auth()