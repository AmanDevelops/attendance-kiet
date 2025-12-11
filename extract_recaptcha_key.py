import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin

URL = "https://kiet.cybervidya.net/login"
 
KEY_PATTERN = r"(6Le[a-zA-Z0-9_-]{37})"

def extract_key():
    print(f"Fetching {URL}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(URL, headers=headers, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        scripts = soup.find_all('script')
        print(f"Found {len(scripts)} scripts.")
        
      
        priority_scripts = []
        other_scripts = []
        
        for script in scripts:
            src = script.get('src')
            if src:
                if "main" in src or "scripts" in src or "app" in src:
                    priority_scripts.append(src)
                else:
                    other_scripts.append(src)
        
         
        for src in priority_scripts + other_scripts:
            full_url = urljoin(URL, src)
            if "styles" in src or "polyfills" in src: continue
            
            print(f"Scanning {src}...")
            try:
                js_response = requests.get(full_url, headers=headers, timeout=20)
                if js_response.status_code == 200:
                    content = js_response.text
                     
                    matches = re.findall(KEY_PATTERN, content)
                    if matches:
                        print(f"\n[SUCCESS] KEY FOUND in {src}:")
                        print(f"Key: {matches[0]}")
                        return matches[0]
                    
                     
                    if "sitekey" in content.lower():
                        print(f"  -> Found 'sitekey' in {src}, but regex didn't match perfectly. Searching context...")
                   
                        pass

            except Exception as e:
                print(f"  Failed to fetch {src}: {e}")

        print("\nNo key found in scripts.")
        return None

    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    extract_key()
