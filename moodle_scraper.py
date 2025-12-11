# for scraping data
import requests
from bs4 import BeautifulSoup
import json
import datetime
import time

 
MOODLE_URL = "http://lms.kiet.edu/moodle"
USERNAME = "test@test.com"
PASSWORD = "test"

LOGIN_URL = f"{MOODLE_URL}/login/index.php"
SERVICE_URL = f"{MOODLE_URL}/lib/ajax/service.php"


def login(session):
   
    print(f"Logging in as {USERNAME}...")
    
 
    response = session.get(LOGIN_URL)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    logintoken = soup.find('input', {'name': 'logintoken'})['value']
    
 
    payload = {
        'username': USERNAME,
        'password': PASSWORD,
        'logintoken': logintoken
    }
    response = session.post(LOGIN_URL, data=payload)
    response.raise_for_status()
    
   
    if "Dashboard" not in response.text and "My courses" not in response.text:
        
        if response.url == f"{MOODLE_URL}/my/":
             pass
        elif "Invalid login" in response.text:
             raise Exception("Login failed: Invalid credentials.")
        else:
            #session key check karo
             pass
 
    dashboard_response = session.get(f"{MOODLE_URL}/my/")
    soup = BeautifulSoup(dashboard_response.text, 'html.parser')
    
   
    sesskey = None
    scripts = soup.find_all('script')
    for script in scripts:
        if script.string and '"sesskey":' in script.string:
            import re
            match = re.search(r'"sesskey":"([^"]+)"', script.string)
            if match:
                sesskey = match.group(1)
                break
    
    if not sesskey:
        print("Warning: Could not find sesskey in Dashboard HTML. Trying to find it in the logout link...")
       
        logout_link = soup.find('a', href=lambda x: x and 'logout.php' in x)
        if logout_link:
             import urllib.parse
             query = urllib.parse.urlparse(logout_link['href']).query
             params = urllib.parse.parse_qs(query)
             if 'sesskey' in params:
                 sesskey = params['sesskey'][0]

    if not sesskey:
        raise Exception("Failed to retrieve sesskey. Login might have failed.")
    
    print(f"Logged in successfully. Sesskey: {sesskey}")
    return sesskey

def get_assignments(session, sesskey):
 
    print("Fetching assignments...")
    
   
    now = int(time.time())
    start_time = now - (30 * 24 * 60 * 60)
    end_time = now + (180 * 24 * 60 * 60) 
    
    #calender pae jake assignment check karega 
    payload = [
        {
            "index": 0,
            "methodname": "core_calendar_get_action_events_by_timesort",
            "args": {
                "timesortfrom": start_time,
                "timesortto": end_time,
                "limitnum": 50
            }
        }
    ]
    
    # Query parameters
    params = {
        'sesskey': sesskey,
        'info': 'core_calendar_get_action_events_by_timesort'
    }
    
    response = session.post(SERVICE_URL, params=params, json=payload)
    response.raise_for_status()
    data = response.json()
    
    if isinstance(data, list) and len(data) > 0:
        if data[0].get('error'):
             raise Exception(f"API Error: {data[0]['error']}")
  #list return 
    events = data[0]['data']['events']
    
    assignments = []
    
    for event in events:
        # Extract relevant details
        name = event.get('name')
        course = event.get('course', {}).get('fullname', 'Unknown Course')
        due_date_ts = event.get('timesort')
        due_date = datetime.datetime.fromtimestamp(due_date_ts).strftime('%Y-%m-%d %H:%M:%S')
        action_name = event.get('action', {}).get('name', '')
        is_completed = event.get('completed', False) # moodle iss function wajah sae bitch kar raha tha
 
        status = "Left"
        if due_date_ts < now:
             status = "Overdue/Past" # kabhi kabhi miss kar ja raha 
        else:
             status = "Upcoming"
           
        assignments.append({
            'Course': course,
            'Assignment': name,
            'Due Date': due_date,
            'Status': status,
            'RawType': event.get('eventtype'),
            'Action': action_name
        })
        
    return assignments

def main():
    with requests.Session() as session:
        try:
            sesskey = login(session)
            assignments = get_assignments(session, sesskey)
            
            print(f"\nFound {len(assignments)} assignments:")
            print("-" * 120)
            print(f"{'Course':<40} | {'Assignment':<40} | {'Due Date':<20} | {'Status'}")
            print("-" * 120)
            
            for task in assignments:
                course = task['Course'].replace('\n', ' ').strip()
                assignment = task['Assignment'].replace('\n', ' ').strip()
                print(f"{course[:38]:<40} | {assignment[:38]:<40} | {task['Due Date']:<20} | {task['Status']}")
                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()
