import json
import urllib.request

url = "https://ewyimfqupeddroieojhl.supabase.co/rest/v1/"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3eWltZnF1cGVkZHJvaWVvamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzM0MDQsImV4cCI6MjA5Nzc0OTQwNH0.oH7vWlSbYlYeLs-HtY3WlMVGH7tB1zv_J1CgmSZHVG8"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        schema = json.loads(response.read().decode())
        # Print table names and their properties
        for title, definition in schema.get("definitions", {}).items():
            print(f"Table: {title}")
            for prop_name, prop_data in definition.get("properties", {}).items():
                print(f"  - {prop_name}: {prop_data.get('type')} ({prop_data.get('format', 'no format')})")
except Exception as e:
    print(f"Error fetching schema: {e}")
