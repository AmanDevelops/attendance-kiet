# for scrapping
import requests
import json

URL = "https://kiet.cybervidya.net/api/auth/login"
CREDENTIALS = {
    "userName": "test@test.com",
    "password": "test"
}

try:
    print(f"Attempting login to {URL} with user {CREDENTIALS['userName']}...")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.post(URL, json=CREDENTIALS, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {response.headers}")
    print(f"Response Body: {response.text}")
    
    if response.status_code == 200:
        print("Login Successful!")
    else:
        print("Login Failed.")
        
except Exception as e:
    print(f"Error: {e}")
