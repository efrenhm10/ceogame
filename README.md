# Going Concern

A realistic CEO simulator that runs in the browser. You found a company in one of 15 industries and one of 18 U.S. cities, Honolulu included, and run it one month at a time. From there you can grow it into a giant, sell it, or take a CEO job at a bigger company.

## Play

Open `index.html` in any modern browser. There's no build step and nothing to install. The game autosaves in your browser.

## What you manage

- **Industry.** The choices are snack foods, beverages, beauty, apparel, restaurants, B2B SaaS, consumer fintech, consumer electronics, residential solar, EVs and e-mobility, renewable power, oil and gas, airlines, trucking and logistics, and AI data centers. Each one has its own products, facilities, cost structure, seasonality and risks.
- **City.** Each city has its own wages, rents, power prices, taxes, inbound freight costs, tourism, disaster risk, talent pools and natural resources. In Honolulu, everything arrives by Jones Act ship, power costs about 40¢/kWh, there's the General Excise Tax, and roughly 10 million visitors a year drive demand.
- **Supply chain.** Raw materials have live market prices. For each one you choose a local, domestic or overseas supplier, each with its own lead time, reliability, payment terms and tariff exposure. You also set how many months of stock to hold and can lock in 12-month fixed prices. Perishables spoil. Late shipments stop the line unless you pay to expedite.
- **Operations.** You start with a co-packer, food truck, leased Cessna or working interest. From there you build plants, locations, fleets, wells and solar farms, which can be in other cities. You set prices against a market reference that rises with inflation.
- **People.** You set headcount for operations, sales, R&D, support and G&A, plus a pay policy. Morale, quits, union drives and minimum-wage changes all matter.
- **Markets.** Marketing builds awareness and your sales team or locations build reach. You expand from your home metro to the rest of the state, then the country, then abroad.
- **Finance.** You get a full monthly P&L, balance sheet and cash flow with receivables and payables timing. You can borrow through SBA loans, revolvers, equipment loans, term loans, venture debt and bonds. You can raise friends-and-family, angel, seed, Series A–C, private equity and IPO rounds. Your board can fire you if you own less than half the company.
- **Career.** Headhunters bring offers to run existing companies of any size. Acquirers make offers for your company. You can resign, found again, sell old stakes, or go bankrupt and recover.

## Code

| File | Contents |
|---|---|
| `data.js` | Cities, commodities, supplier types and industry definitions |
| `engine.js` | The monthly simulation: demand, procurement, production, accounting, finance, events and career |
| `ui.js` | Rendering and interaction |
| `style.css` | Styles (light and dark) |
| `index.html` | Standalone page |
| `artifact.html` | The same game as a page fragment for hosted embedding |

`data.js` and `engine.js` have no DOM dependencies, so you can run the engine headless in Node:

```js
require('./data.js'); require('./engine.js');
const s = GC.newGame({ bg: 'manager', ind: 'snacks', city: 'honolulu', name: 'Kai Snacks', invest: 150000, sba: 0, angel: 0, salary: 0, marketing: 2500 });
GC.advance(s);
console.log(s.co.hist[0]);
```
