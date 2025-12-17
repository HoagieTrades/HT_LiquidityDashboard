import pandas as pd
import json

def fetch_and_save_dashboard_data():
    print("Fetching data directly from FRED CSVs...")
    
    urls = {
        "WALCL": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=WALCL",       # Weekly Assets (Millions)
        "WDTGAL": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=WDTGAL",     # DAILY TGA (Millions) <-- NEW SOURCE
        "RRPONTSYD": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=RRPONTSYD", # Daily RRP (Billions)
        "H41RESPPALDKNWW": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=H41RESPPALDKNWW", # Weekly Loans (Millions)
        "WLCFLL": "https://fred.stlouisfed.org/graph/fredgraph.csv?id=WLCFLL"      # Weekly Loans (Millions)
    }
    
    data_frames = []

    for name, url in urls.items():
        print(f"Downloading {name}...")
        try:
            df = pd.read_csv(url, index_col=0, parse_dates=True)
            df.columns = [name]
            # Resample to Daily to align everyone
            df = df.resample('D').mean()
            data_frames.append(df)
        except Exception as e:
            print(f"Error downloading {name}: {e}")
            return

    # Merge
    df_merged = pd.concat(data_frames, axis=1)
    
    # Interpolate (Smooths the Weekly data like WALCL, leaves Daily data mostly alone)
    df_merged = df_merged.interpolate(method='linear')
    df_merged = df_merged.dropna()

    # --- NORMALIZE UNITS TO BILLIONS ---
    
    # 1. Fed Assets (Millions -> Billions)
    df_merged['Fed_Assets'] = df_merged['WALCL'] / 1000
    
    # 2. TGA (Daily dataset is in Millions -> Billions)
    # Note: The old Weekly dataset was Billions, but Daily is Millions.
    df_merged['TGA'] = df_merged['WDTGAL'] / 1000       
    
    # 3. RRP (Already Billions)
    df_merged['RRP'] = df_merged['RRPONTSYD']
    
    # 4. Loans (Millions -> Billions)
    df_merged['Loans_Facilities'] = df_merged['H41RESPPALDKNWW'] / 1000
    df_merged['Loans_Held'] = df_merged['WLCFLL'] / 1000
    
    # Formula #1: Assets - TGA - RRP + Loans + Loans
    df_merged['Formula_1'] = (
        df_merged['Fed_Assets'] 
        - df_merged['TGA'] 
        - df_merged['RRP'] 
        + df_merged['Loans_Facilities'] 
        + df_merged['Loans_Held']
    )
    
    last_date = df_merged.index[-1].strftime('%Y-%m-%d')

    output = {
        "meta": { "last_updated": last_date },
        "formula_1": [],
        "fed_assets": [],
        "tga": [],
        "rrp": [],
        "loans_facilities": [],
        "loans_held": []
    }
    
    for date, row in df_merged.iterrows():
        date_str = date.strftime('%Y-%m-%d')
        output["formula_1"].append([date_str, round(row['Formula_1'], 2)])
        output["fed_assets"].append([date_str, round(row['Fed_Assets'], 2)])
        output["tga"].append([date_str, round(row['TGA'], 2)])
        output["rrp"].append([date_str, round(row['RRP'], 2)])
        output["loans_facilities"].append([date_str, round(row['Loans_Facilities'], 2)])
        output["loans_held"].append([date_str, round(row['Loans_Held'], 2)])
        
    with open('public/data.json', 'w') as f:
        json.dump(output, f)
    
    print(f"Success! Switched to DAILY TGA. Last data point: {last_date}")

if __name__ == "__main__":
    fetch_and_save_dashboard_data()