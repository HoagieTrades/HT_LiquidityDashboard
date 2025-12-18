import pandas as pd
import pandas_datareader.data as web
import requests
import datetime
import sys

# --- CONFIGURATION ---
START_DATE = '2023-01-01'
TODAY = datetime.datetime.today().strftime('%Y-%m-%d')

def fetch_treasury_tga():
    """
    Fetches Daily TGA from US Treasury.
    SMART LOGIC: Fetches both 'Open' and 'Close'.
    If 'Close' is null, falls back to 'Open'.
    """
    base_url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance"
    
    # FETCH BOTH COLUMNS
    params = {
        'fields': 'record_date,account_type,open_today_bal,close_today_bal',
        'filter': f'record_date:gte:{START_DATE}', 
        'page[size]': 5000,
        'sort': '-record_date'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
    }
    
    print(f"Fetching TGA from: {base_url} ...")
    
    try:
        response = requests.get(base_url, params=params, headers=headers)
        data = response.json()
        
        if 'data' not in data: return pd.DataFrame()
        df = pd.DataFrame(data['data'])
        if df.empty: return pd.DataFrame()

        # 1. Filter for Treasury General Account
        mask = df['account_type'].str.contains("Treasury General Account", case=False)
        df = df[mask].copy()

        # 2. CLEANING: Remove commas
        df['close_clean'] = pd.to_numeric(df['close_today_bal'].astype(str).str.replace(',', ''), errors='coerce')
        df['open_clean'] = pd.to_numeric(df['open_today_bal'].astype(str).str.replace(',', ''), errors='coerce')

        # 3. SMART SELECTION (Close > Open)
        df['TGA_Daily'] = df['close_clean'].fillna(df['open_clean'])
        
        # 4. Drop empty rows
        df = df.dropna(subset=['TGA_Daily'])

        # 5. Process Dates
        df['date'] = pd.to_datetime(df['record_date'])
        
        # 6. Deduplicate
        df = df.groupby('date')['TGA_Daily'].first().reset_index()

        # NOTE: Treasury data is ALREADY in Millions (e.g. 887,180), so NO division needed.
        
        df = df.set_index('date')
        df = df.sort_index()
        
        print(f"Successfully loaded {len(df)} daily TGA records.")
        return df[['TGA_Daily']]

    except Exception as e:
        print(f"Error fetching Treasury API: {e}")
        return pd.DataFrame()

def fetch_fred_data():
    """Fetches WALCL, RRP, Loans, and Backup TGA from FRED."""
    print("Fetching FRED Data (Assets, RRP, Loans)...")
    try:
        # Added 'H41RESPPALDKNWW' (Liquidity Facilities) and 'WLCFLL' (Loans Held)
        fred_data = web.DataReader(
            ['WALCL', 'RRPONTSYD', 'WDTGAL', 'H41RESPPALDKNWW', 'WLCFLL'], 
            'fred', 
            START_DATE, 
            TODAY
        )
        
        fred_data = fred_data.rename(columns={
            'WALCL': 'Fed_Assets', 
            'RRPONTSYD': 'RRP',
            'WDTGAL': 'TGA_Weekly',
            'H41RESPPALDKNWW': 'Liquidity_Facilities',
            'WLCFLL': 'Loans_Held'
        })
        return fred_data
    except Exception as e:
        print(f"Error fetching FRED data: {e}")
        return pd.DataFrame()

def main():
    # 1. Get the data
    tga_df = fetch_treasury_tga()
    fred_df = fetch_fred_data()
    
    if fred_df.empty:
        print("CRITICAL: No FRED data found. Exiting.")
        sys.exit(1)

    # 2. Merge Data
    if not tga_df.empty:
        merged_df = fred_df.join(tga_df, how='outer')
        merged_df['Final_TGA'] = merged_df['TGA_Daily']
        merged_df['Final_TGA'] = merged_df['Final_TGA'].ffill()
    else:
        print("WARNING: Using Weekly TGA (FRED) as fallback.")
        merged_df = fred_df.copy()
        # Weekly TGA is in Billions, multiply by 1000 to get Millions
        merged_df['Final_TGA'] = merged_df['TGA_Weekly'] * 1000

    # 3. Fill Missing Values
    merged_df = merged_df.ffill().dropna()

    # 4. Calculate Net Liquidity (Formula 1)
    # Formula: Assets - TGA - RRP + Loans + Liquidity Facilities
    # Units: All converted to Millions
    merged_df['Net_Liquidity'] = (
        merged_df['Fed_Assets'] 
        - merged_df['Final_TGA'] 
        - (merged_df['RRP'] * 1000) 
        + merged_df['Liquidity_Facilities'] 
        + merged_df['Loans_Held']
    )
    
    # 5. Format and Save
    merged_df.index.name = 'date'
    final_df = merged_df.reset_index()
    final_df['date'] = final_df['date'].dt.strftime('%Y-%m-%d')
    
    # Select all columns needed for the frontend
    output_df = final_df[[
        'date', 
        'Net_Liquidity', 
        'Fed_Assets', 
        'RRP', 
        'Final_TGA', 
        'Liquidity_Facilities', 
        'Loans_Held'
    ]]
    
    # Rename Final_TGA back to TGA_Daily for the frontend
    output_df = output_df.rename(columns={'Final_TGA': 'TGA_Daily'})
    
    print("Saving data to public/data.json...")
    output_df.to_json('public/data.json', orient='records')
    print("Done! Data updated.")

if __name__ == "__main__":
    main()