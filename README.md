# **How's Satoshi: Bitcoin Market Sentiment**

"How's Satoshi" is a real-time Bitcoin market sentiment tracker presented in a unique and engaging way. Instead of relying on complex charts and graphs, the application uses the facial expression of a digital Satoshi Nakamoto statue to reflect the current state of the Bitcoin market.

## **Features**

* **Dynamic Visuals:** The Satoshi statue's expression changes based on the live market conditions.  
* **Real-time Metrics:** Displays key Bitcoin metrics including current price, 24-hour change, market capitalization, estimated daily energy usage of the network, and the mining difficulty target.  
* **Intuitive Sentiment:**  
  * **Bullish:** A positive face during market rallies.  
  * **Bearish:** A grim expression during significant price drops.  
  * **Neutral:** A calm, stoic look when the market is stable.  
  * **Special States:** Includes unique "Need Energy" and "Doom's Day" states triggered by specific market conditions, each with a tooltip for more information.  
* **Responsive Design:** The interface is built with Tailwind CSS to be clean, modern, and fully responsive on all devices.

## **How It Works**

This application fetches real-time data from various public APIs to provide an accurate reflection of the Bitcoin market.

* **Market Data:** Live price, market cap, and 24-hour change are retrieved from a cryptocurrency data API.  
* **Network Metrics:** The mining difficulty and estimated network energy usage are sourced from Bitcoin-specific blockchain APIs.  
* **Sentiment Logic:** A simple JavaScript logic analyzes the price change and other metrics to determine the current sentiment and updates the visual representation of the Satoshi statue accordingly. The "Doom's Day" sentiment is triggered if the price drops by more than 10% in the last 24 hours. The "Need Energy" sentiment is based on a high difficulty target.

## **Technology Used**

* **HTML:** For the page structure.  
* **CSS:** Tailwind CSS for styling and responsive design.  
* **JavaScript:** For fetching API data, handling the sentiment logic, and dynamically updating the page content.  
* **Public APIs:**  
  * CoinGecko API for market data.  
  * Blockstream API and mempool.space for Bitcoin network data.