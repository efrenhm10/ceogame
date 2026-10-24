/* Going Concern — static game data: cities, commodities, suppliers, industries.
   All money in USD (2027 dollars). All rates are monthly unless noted. */
(function (G) {
  'use strict';

  // ---------- Cities ----------
  // wage: labor cost index; officeRent/indRent: $/sq ft/yr; elec: commercial $/kWh;
  // ppa: wholesale power $/MWh; solarCF/windCF: capacity factors; stateTax: corporate
  // income tax; grossTax: gross-receipts tax on revenue (retail rate, wholesale rate);
  // inbound: freight multiplier on supplies from off-island/out-of-region;
  // nationalFreight: multiplier on outbound freight to the rest of the U.S.;
  // tourism: 0..1 share of local demand driven by visitors; oil/gas: basin quality 0..1.
  const CITIES = [
    { id: 'honolulu', name: 'Honolulu', st: 'HI', metro: 1.0e6, regionName: 'Neighbor Islands', regionPop: 1.44e6,
      wage: 1.12, officeRent: 40, indRent: 24, elec: 0.40, ppa: 140, solarCF: 0.20, windCF: 0.34, stateTax: 0.064,
      grossTax: [0.04712, 0.005], inbound: 1.14, nationalFreight: 1.6, intlFreight: 1.25, tourism: 1.0,
      risk: { hurricane: 0.018, quake: 0, wildfire: 0.004, freeze: 0 }, talent: { tech: 0.45, mfg: 0.35, energy: 0.5, food: 0.85, travel: 1.0 },
      oil: 0, gas: 0, minWage: 16, land: 4,
      localSpecialty: ['macnut', 'coffee', 'fish', 'produce'],
      notes: 'Everything arrives by Jones Act ship, the highest power prices in the U.S., ~10M visitors a year, and Hawaii\'s General Excise Tax on gross receipts.' },
    { id: 'newyork', name: 'New York', st: 'NY', metro: 19.5e6, regionName: 'Northeast Corridor', regionPop: 55e6,
      wage: 1.30, officeRent: 78, indRent: 22, elec: 0.22, ppa: 75, solarCF: 0.15, windCF: 0.30, stateTax: 0.11,
      grossTax: [0, 0], inbound: 1.03, nationalFreight: 1.05, intlFreight: 1.15, tourism: 0.35,
      risk: { hurricane: 0.004, quake: 0, wildfire: 0, freeze: 0.01 }, talent: { tech: 0.85, mfg: 0.5, energy: 0.5, food: 0.9, travel: 0.8, finance: 1 },
      oil: 0, gas: 0, minWage: 16.5, notes: 'Huge market and talent pool; the most expensive offices and a combined state + city corporate tax.' },
    { id: 'losangeles', name: 'Los Angeles', st: 'CA', metro: 13e6, regionName: 'Rest of California', regionPop: 39e6,
      wage: 1.22, officeRent: 48, indRent: 20, elec: 0.26, ppa: 70, solarCF: 0.24, windCF: 0.30, stateTax: 0.0884,
      grossTax: [0, 0], inbound: 1.0, nationalFreight: 1.05, intlFreight: 1.1, tourism: 0.3,
      risk: { hurricane: 0, quake: 0.006, wildfire: 0.012, freeze: 0 }, talent: { tech: 0.75, mfg: 0.7, energy: 0.5, food: 0.95, travel: 0.8 },
      oil: 0.2, gas: 0.1, minWage: 17.3, notes: 'Ports of LA/Long Beach next door, a giant consumer market, high taxes, wildfire and quake risk.' },
    { id: 'sanfrancisco', name: 'San Francisco', st: 'CA', metro: 7.7e6, regionName: 'Rest of California', regionPop: 39e6,
      wage: 1.38, officeRent: 70, indRent: 22, elec: 0.30, ppa: 70, solarCF: 0.21, windCF: 0.32, stateTax: 0.0884,
      grossTax: [0, 0], inbound: 1.0, nationalFreight: 1.05, intlFreight: 1.1, tourism: 0.25,
      risk: { hurricane: 0, quake: 0.008, wildfire: 0.006, freeze: 0 }, talent: { tech: 1.0, mfg: 0.4, energy: 0.6, food: 0.8, travel: 0.7 },
      oil: 0, gas: 0, minWage: 19.2, notes: 'The deepest software and VC talent pool anywhere, at the highest salaries.' },
    { id: 'seattle', name: 'Seattle', st: 'WA', metro: 4.1e6, regionName: 'Pacific Northwest', regionPop: 13e6,
      wage: 1.22, officeRent: 42, indRent: 15, elec: 0.11, ppa: 45, solarCF: 0.14, windCF: 0.30, stateTax: 0,
      grossTax: [0.005, 0.005], inbound: 1.0, nationalFreight: 1.08, intlFreight: 1.05, tourism: 0.15,
      risk: { hurricane: 0, quake: 0.004, wildfire: 0.004, freeze: 0.004 }, talent: { tech: 0.95, mfg: 0.7, energy: 0.6, food: 0.7, travel: 0.8 },
      oil: 0, gas: 0, minWage: 17.1, notes: 'No corporate income tax but a B&O tax on gross receipts; cheap hydro power and a cloud-computing workforce.' },
    { id: 'austin', name: 'Austin', st: 'TX', metro: 2.5e6, regionName: 'Rest of Texas', regionPop: 31e6,
      wage: 1.05, officeRent: 45, indRent: 12, elec: 0.10, ppa: 40, solarCF: 0.23, windCF: 0.36, stateTax: 0,
      grossTax: [0.0045, 0.0045], inbound: 1.0, nationalFreight: 1.0, intlFreight: 1.1, tourism: 0.15,
      risk: { hurricane: 0.002, quake: 0, wildfire: 0.003, freeze: 0.01 }, talent: { tech: 0.8, mfg: 0.6, energy: 0.7, food: 0.7, travel: 0.6 },
      oil: 0.3, gas: 0.3, minWage: 7.25, notes: 'Fast-growing tech hub, Texas franchise tax instead of income tax, ERCOT grid exposure.' },
    { id: 'houston', name: 'Houston', st: 'TX', metro: 7.4e6, regionName: 'Rest of Texas', regionPop: 31e6,
      wage: 1.02, officeRent: 32, indRent: 9, elec: 0.10, ppa: 40, solarCF: 0.21, windCF: 0.33, stateTax: 0,
      grossTax: [0.0045, 0.0045], inbound: 0.98, nationalFreight: 1.0, intlFreight: 1.05, tourism: 0.1,
      risk: { hurricane: 0.012, quake: 0, wildfire: 0, freeze: 0.008 }, talent: { tech: 0.55, mfg: 0.85, energy: 1.0, food: 0.8, travel: 0.7 },
      oil: 0.55, gas: 0.6, minWage: 7.25, notes: 'Energy capital of the world: oilfield talent, Gulf ports and refineries, and hurricane season.' },
    { id: 'midland', name: 'Midland', st: 'TX', metro: 0.36e6, regionName: 'Rest of Texas', regionPop: 31e6,
      wage: 1.08, officeRent: 24, indRent: 8, elec: 0.09, ppa: 35, solarCF: 0.26, windCF: 0.38, stateTax: 0,
      grossTax: [0.0045, 0.0045], inbound: 1.02, nationalFreight: 1.02, intlFreight: 1.1, tourism: 0,
      risk: { hurricane: 0, quake: 0, wildfire: 0.002, freeze: 0.008 }, talent: { tech: 0.15, mfg: 0.5, energy: 1.0, food: 0.4, travel: 0.3 },
      oil: 1.0, gas: 0.8, minWage: 7.25, notes: 'Heart of the Permian Basin. Best shale rock in America; tiny consumer market.' },
    { id: 'okc', name: 'Oklahoma City', st: 'OK', metro: 1.45e6, regionName: 'Southern Plains', regionPop: 8e6,
      wage: 0.92, officeRent: 20, indRent: 6, elec: 0.10, ppa: 32, solarCF: 0.22, windCF: 0.45, stateTax: 0.04,
      grossTax: [0, 0], inbound: 1.0, nationalFreight: 1.0, intlFreight: 1.1, tourism: 0.05,
      risk: { hurricane: 0, quake: 0.002, wildfire: 0.002, freeze: 0.006, tornado: 0.01 }, talent: { tech: 0.3, mfg: 0.6, energy: 0.9, food: 0.5, travel: 0.4 },
      oil: 0.7, gas: 0.8, minWage: 7.25, notes: 'Low costs, SCOOP/STACK oil plays, and the best wind resource on this list.' },
    { id: 'denver', name: 'Denver', st: 'CO', metro: 3.0e6, regionName: 'Mountain West', regionPop: 12e6,
      wage: 1.08, officeRent: 32, indRent: 11, elec: 0.13, ppa: 45, solarCF: 0.22, windCF: 0.38, stateTax: 0.044,
      grossTax: [0, 0], inbound: 1.02, nationalFreight: 1.02, intlFreight: 1.12, tourism: 0.15,
      risk: { hurricane: 0, quake: 0, wildfire: 0.006, freeze: 0.006 }, talent: { tech: 0.7, mfg: 0.55, energy: 0.8, food: 0.6, travel: 0.6 },
      oil: 0.6, gas: 0.6, minWage: 15.2, notes: 'DJ Basin oil, strong wind and sun, an outdoorsy consumer base.' },
    { id: 'phoenix', name: 'Phoenix', st: 'AZ', metro: 5.1e6, regionName: 'Southwest', regionPop: 12e6,
      wage: 1.0, officeRent: 30, indRent: 10, elec: 0.13, ppa: 38, solarCF: 0.28, windCF: 0.25, stateTax: 0.049,
      grossTax: [0, 0], inbound: 1.0, nationalFreight: 1.02, intlFreight: 1.1, tourism: 0.2,
      risk: { hurricane: 0, quake: 0, wildfire: 0.004, freeze: 0, heat: 0.02 }, talent: { tech: 0.55, mfg: 0.75, energy: 0.6, food: 0.6, travel: 0.6 },
      oil: 0, gas: 0, minWage: 15.0, notes: 'Best solar resource in the country and a semiconductor fab cluster. Water is the long-term risk.' },
    { id: 'chicago', name: 'Chicago', st: 'IL', metro: 9.4e6, regionName: 'Midwest', regionPop: 68e6,
      wage: 1.08, officeRent: 40, indRent: 9, elec: 0.14, ppa: 45, solarCF: 0.16, windCF: 0.35, stateTax: 0.095,
      grossTax: [0, 0], inbound: 0.98, nationalFreight: 0.95, intlFreight: 1.12, tourism: 0.15,
      risk: { hurricane: 0, quake: 0, wildfire: 0, freeze: 0.012 }, talent: { tech: 0.65, mfg: 1.0, energy: 0.6, food: 1.0, travel: 0.8 },
      oil: 0, gas: 0, minWage: 15.0, notes: 'The country\'s rail and food-processing hub, central to every market, with high state taxes.' },
    { id: 'detroit', name: 'Detroit', st: 'MI', metro: 4.3e6, regionName: 'Midwest', regionPop: 68e6,
      wage: 0.98, officeRent: 22, indRent: 7, elec: 0.17, ppa: 50, solarCF: 0.15, windCF: 0.33, stateTax: 0.06,
      grossTax: [0, 0], inbound: 0.98, nationalFreight: 0.97, intlFreight: 1.12, tourism: 0.05,
      risk: { hurricane: 0, quake: 0, wildfire: 0, freeze: 0.012 }, talent: { tech: 0.5, mfg: 1.0, energy: 0.5, food: 0.6, travel: 0.5, auto: 1 },
      oil: 0, gas: 0.2, minWage: 12.5, notes: 'Auto-industry engineering and suppliers, cheap industrial space.' },
    { id: 'pittsburgh', name: 'Pittsburgh', st: 'PA', metro: 2.4e6, regionName: 'Appalachia', regionPop: 26e6,
      wage: 0.97, officeRent: 26, indRent: 7, elec: 0.15, ppa: 50, solarCF: 0.15, windCF: 0.30, stateTax: 0.0749,
      grossTax: [0, 0], inbound: 0.99, nationalFreight: 0.98, intlFreight: 1.12, tourism: 0.05,
      risk: { hurricane: 0, quake: 0, wildfire: 0, freeze: 0.01 }, talent: { tech: 0.65, mfg: 0.8, energy: 0.8, food: 0.6, travel: 0.4 },
      oil: 0.1, gas: 1.0, minWage: 7.25, notes: 'On top of the Marcellus shale, the largest gas field in the U.S.; robotics talent from CMU.' },
    { id: 'atlanta', name: 'Atlanta', st: 'GA', metro: 6.3e6, regionName: 'Southeast', regionPop: 60e6,
      wage: 1.0, officeRent: 33, indRent: 8, elec: 0.12, ppa: 45, solarCF: 0.20, windCF: 0.22, stateTax: 0.0539,
      grossTax: [0, 0], inbound: 0.99, nationalFreight: 0.98, intlFreight: 1.1, tourism: 0.15,
      risk: { hurricane: 0.003, quake: 0, wildfire: 0, freeze: 0.004 }, talent: { tech: 0.65, mfg: 0.75, energy: 0.5, food: 0.8, travel: 1.0 },
      oil: 0, gas: 0, minWage: 7.25, notes: 'World\'s busiest airport, a logistics crossroads, and a low-cost Southeast market.' },
    { id: 'nashville', name: 'Nashville', st: 'TN', metro: 2.1e6, regionName: 'Southeast', regionPop: 60e6,
      wage: 0.98, officeRent: 34, indRent: 9, elec: 0.12, ppa: 45, solarCF: 0.18, windCF: 0.2, stateTax: 0.065,
      grossTax: [0, 0], inbound: 1.0, nationalFreight: 0.98, intlFreight: 1.12, tourism: 0.3,
      risk: { hurricane: 0, quake: 0, wildfire: 0, freeze: 0.004, tornado: 0.006 }, talent: { tech: 0.5, mfg: 0.75, energy: 0.4, food: 0.7, travel: 0.5 },
      oil: 0, gas: 0, minWage: 7.25, notes: 'Booming Sun Belt metro, a hub for EV and battery plants, no personal income tax.' },
    { id: 'miami', name: 'Miami', st: 'FL', metro: 6.2e6, regionName: 'Rest of Florida', regionPop: 23e6,
      wage: 1.02, officeRent: 55, indRent: 16, elec: 0.13, ppa: 50, solarCF: 0.21, windCF: 0.2, stateTax: 0.055,
      grossTax: [0, 0], inbound: 1.0, nationalFreight: 1.03, intlFreight: 1.0, tourism: 0.55,
      risk: { hurricane: 0.016, quake: 0, wildfire: 0, freeze: 0 }, talent: { tech: 0.55, mfg: 0.45, energy: 0.4, food: 0.8, travel: 1.0, finance: 0.8 },
      oil: 0, gas: 0, minWage: 14, notes: 'Gateway to Latin America, big tourism economy, and the highest hurricane and insurance risk on the mainland.' },
    { id: 'boston', name: 'Boston', st: 'MA', metro: 4.9e6, regionName: 'New England', regionPop: 15e6,
      wage: 1.28, officeRent: 60, indRent: 18, elec: 0.28, ppa: 70, solarCF: 0.15, windCF: 0.33, stateTax: 0.08,
      grossTax: [0, 0], inbound: 1.02, nationalFreight: 1.05, intlFreight: 1.12, tourism: 0.2,
      risk: { hurricane: 0.003, quake: 0, wildfire: 0, freeze: 0.012 }, talent: { tech: 0.9, mfg: 0.55, energy: 0.6, food: 0.7, travel: 0.6 },
      oil: 0, gas: 0, minWage: 15, notes: 'World-class universities and engineering talent, expensive power, offshore wind leases.' }
  ];

  // ---------- Commodities ----------
  // base price (2027 $), vol = monthly volatility, theta = mean reversion, spoil = monthly
  // spoilage of stock, stock=false means bought as consumed (fuel, compute) and cannot be
  // stockpiled, src = which supplier types exist (L local, D domestic, O overseas), tariff = exposed to import tariffs.
  const COMMODITIES = {
    potato:  { name: 'Potatoes', unit: 'lb', base: 0.24, vol: 0.05, theta: 0.2, spoil: 0.15, src: 'LD', names: ['Island Produce Distributors', 'Columbia Basin Growers (WA)'] },
    vegoil:  { name: 'Vegetable oil', unit: 'lb', base: 0.62, vol: 0.06, theta: 0.15, spoil: 0, src: 'LDO', tariff: true, names: ['Restaurant Depot', 'ADM Oilseeds (IL)', 'Wilmar International (Malaysia)'] },
    flour:   { name: 'Wheat flour', unit: 'lb', base: 0.32, vol: 0.04, theta: 0.15, spoil: 0.01, src: 'LDO', names: ['Local bakery supply', 'Ardent Mills (KS)', 'Prairie Export Grain (Canada)'] },
    sugar:   { name: 'Cane sugar', unit: 'lb', base: 0.48, vol: 0.05, theta: 0.15, spoil: 0, src: 'LDO', tariff: true, names: ['Local foodservice distributor', 'Domino Sugar (LA)', 'Mitr Phol (Thailand)'] },
    cocoa:   { name: 'Cocoa beans', unit: 'lb', base: 2.60, vol: 0.09, theta: 0.08, spoil: 0.01, src: 'DO', tariff: true, names: ['', 'Barry Callebaut USA (PA)', 'Abidjan Cocoa Export (Côte d\'Ivoire)'] },
    macnut:  { name: 'Macadamia nuts', unit: 'lb', base: 6.20, vol: 0.05, theta: 0.12, spoil: 0.02, src: 'LDO', tariff: true, names: ['Big Island macadamia co-op', 'California nut packer', 'Limpopo Macadamia (South Africa)'] },
    coffee:  { name: 'Green coffee (arabica)', unit: 'lb', base: 3.80, vol: 0.08, theta: 0.08, spoil: 0.005, src: 'LDO', tariff: true, names: ['Kona & Ka\'u growers', 'Coffee importer (Oakland)', 'Minas Gerais exporter (Brazil)'] },
    dairy:   { name: 'Milk', unit: 'gal', base: 2.30, vol: 0.05, theta: 0.2, spoil: 0.5, src: 'LD', names: ['Local dairy', 'Regional dairy co-op'] },
    alcan:   { name: 'Aluminum cans', unit: 'can', base: 0.11, vol: 0.05, theta: 0.12, spoil: 0, src: 'DO', tariff: true, names: ['', 'Ball Corp. (CO)', 'Can-Pack Asia (Thailand)'] },
    glass:   { name: 'Glass bottles', unit: 'bottle', base: 0.28, vol: 0.03, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'O-I Glass (OH)', 'Guangdong Glassworks (China)'] },
    film:    { name: 'Flexible packaging film', unit: 'pc', base: 0.06, vol: 0.04, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Amcor Flexibles (WI)', 'Saigon Flexpack (Vietnam)'] },
    carton:  { name: 'Corrugated cartons', unit: 'case', base: 0.95, vol: 0.04, theta: 0.1, spoil: 0, src: 'LD', names: ['Local box maker', 'International Paper (TN)'] },
    flavor:  { name: 'Flavor & caffeine blend', unit: 'kg', base: 18, vol: 0.03, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Flavor house (NJ)', 'Zhejiang flavor ingredients (China)'] },
    co2:     { name: 'Beverage-grade CO2', unit: 'lb', base: 0.14, vol: 0.08, theta: 0.3, spoil: 0, src: 'LD', names: ['Local gas supplier', 'Linde (CT)'] },
    beef:    { name: 'Ground beef', unit: 'lb', base: 5.40, vol: 0.05, theta: 0.12, spoil: 0.4, src: 'LD', names: ['Foodservice distributor', 'Midwest packer (NE)'] },
    chicken: { name: 'Chicken', unit: 'lb', base: 2.10, vol: 0.05, theta: 0.15, spoil: 0.4, src: 'LD', names: ['Foodservice distributor', 'Southern poultry integrator (GA)'] },
    fish:    { name: 'Fresh ahi tuna', unit: 'lb', base: 9.50, vol: 0.07, theta: 0.2, spoil: 0.7, src: 'LD', names: ['Honolulu fish auction', 'Seafood importer'] },
    produce: { name: 'Fresh produce', unit: 'lb', base: 1.30, vol: 0.07, theta: 0.25, spoil: 0.6, src: 'LD', names: ['Local farms & distributor', 'California produce wholesaler'] },
    rice:    { name: 'Rice', unit: 'lb', base: 0.55, vol: 0.04, theta: 0.1, spoil: 0.01, src: 'LDO', tariff: true, names: ['Foodservice distributor', 'Calrose mill (CA)', 'Thai jasmine exporter'] },
    cotton:  { name: 'Cotton fabric', unit: 'yd', base: 4.10, vol: 0.04, theta: 0.12, spoil: 0, src: 'DO', tariff: true, names: ['', 'Carolina textile mill', 'Dhaka Fabrics (Bangladesh)'] },
    poly:    { name: 'Performance synthetic fabric', unit: 'yd', base: 2.60, vol: 0.04, theta: 0.12, spoil: 0, src: 'DO', tariff: true, names: ['', 'Domestic knit mill (NC)', 'Taipei Technical Textiles (Taiwan)'] },
    trims:   { name: 'Trims, zippers & labels', unit: 'set', base: 0.65, vol: 0.03, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Garment supply (LA)', 'YKK supplier (Vietnam)'] },
    soles:   { name: 'Footwear soles & uppers', unit: 'pair', base: 9.50, vol: 0.04, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Domestic component maker', 'Ho Chi Minh footwear components'] },
    glycerin:{ name: 'Glycerin & carrier oils', unit: 'lb', base: 0.90, vol: 0.04, theta: 0.12, spoil: 0, src: 'DO', tariff: true, names: ['', 'Chemical distributor (NJ)', 'Malaysian oleochemicals'] },
    actives: { name: 'Cosmetic actives & zinc oxide', unit: 'oz', base: 1.40, vol: 0.04, theta: 0.1, spoil: 0.01, src: 'DO', tariff: true, names: ['', 'Specialty ingredients (NJ)', 'Korean cosmetic ingredients (Seoul)'] },
    jars:    { name: 'Jars, tubes & pumps', unit: 'pc', base: 0.42, vol: 0.03, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Packaging converter (OH)', 'Ningbo Cosmetic Packaging (China)'] },
    semis:   { name: 'Semiconductors (chipset)', unit: 'set', base: 19, vol: 0.05, theta: 0.08, spoil: 0, src: 'DO', tariff: true, names: ['', 'Authorized distributor (TX)', 'Taiwan fab via broker'] },
    display: { name: 'Display panels', unit: 'pc', base: 34, vol: 0.04, theta: 0.1, spoil: 0, src: 'O', tariff: true, names: ['', '', 'Korean panel maker'] },
    cells:   { name: 'Li-ion battery cells', unit: 'kWh', base: 92, vol: 0.05, theta: 0.08, spoil: 0, src: 'DO', tariff: true, names: ['', 'Nevada cell plant', 'CATL-licensed supplier (China)'] },
    pcb:     { name: 'PCBs & enclosures', unit: 'set', base: 14, vol: 0.03, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Domestic EMS (MN)', 'Shenzhen EMS'] },
    steel:   { name: 'Steel', unit: 'ton', base: 880, vol: 0.05, theta: 0.12, spoil: 0, src: 'DO', tariff: true, names: ['', 'Nucor (NC)', 'POSCO (Korea)'] },
    aluminum:{ name: 'Aluminum', unit: 'lb', base: 1.30, vol: 0.05, theta: 0.12, spoil: 0, src: 'DO', tariff: true, names: ['', 'Domestic smelter (KY)', 'Gulf aluminum (UAE)'] },
    copper:  { name: 'Copper', unit: 'lb', base: 4.60, vol: 0.06, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Arizona copper mine', 'Chilean copper (Codelco)'] },
    modules: { name: 'Solar modules', unit: 'W', base: 0.28, vol: 0.05, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'First Solar (OH)', 'Southeast Asia module maker'] },
    inverter:{ name: 'Inverters', unit: 'W', base: 0.11, vol: 0.04, theta: 0.1, spoil: 0, src: 'DO', tariff: true, names: ['', 'Enphase distributor', 'Inverter OEM (China)'] },
    racking: { name: 'Racking & balance of system', unit: 'W', base: 0.18, vol: 0.03, theta: 0.1, spoil: 0, src: 'LD', names: ['Local electrical wholesaler', 'Racking maker (CA)'] },
    // consumed as used; cannot be stockpiled; hedgeable with fixed-price contracts
    jetfuel: { name: 'Jet fuel', unit: 'gal', base: 2.35, vol: 0.08, theta: 0.1, spoil: 0, src: 'S', stock: false },
    diesel:  { name: 'Diesel', unit: 'gal', base: 3.55, vol: 0.07, theta: 0.12, spoil: 0, src: 'S', stock: false },
    natgas:  { name: 'Natural gas (Henry Hub)', unit: 'MMBtu', base: 3.30, vol: 0.12, theta: 0.12, spoil: 0, src: 'S', stock: false },
    cloud:   { name: 'Cloud compute', unit: '1k vCPU-hr', base: 38, vol: 0.01, theta: 0.2, spoil: 0, src: 'S', stock: false },
    // market price only (what you sell oil at)
    crude:   { name: 'Crude oil (WTI)', unit: 'bbl', base: 68, vol: 0.08, theta: 0.08, spoil: 0, src: '', stock: false, priceOnly: true }
  };

  // ---------- Supplier archetypes ----------
  const SUPPLIER_TYPES = {
    L: { label: 'Local distributor', mult: 1.15, lead: 0, rel: 0.985, terms: 'net30', why: 'Same-month delivery, small minimums, markup.' },
    D: { label: 'Domestic producer', mult: 1.0, lead: 1, rel: 0.95, terms: 'net30', why: 'Mainland price, one-month lead time, net-30 terms.' },
    O: { label: 'Overseas import', mult: 0.80, lead: 2, rel: 0.88, terms: 'prepay', why: 'Cheapest unit cost, but two-month ocean freight, tariffs, and cash up front.' },
    S: { label: 'Spot market', mult: 1.0, lead: 0, rel: 1, terms: 'net30', why: 'Pay the market price as you consume it.' }
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FLAT = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  // ---------- Industries ----------
  // Product fields: price (default list price you charge), el (price elasticity),
  // bom (commodity qty per unit), labor (production hours per unit at staffed sites),
  // kwh (electricity per unit), var (other variable cost per unit: freight, fees, trade spend),
  // capW (capacity units per product unit), perCap (units per person per month in the
  // addressable segment), unlock (R&D points), launch (one-time launch cost).
  // Facility fields: capex, build (months), cap (capacity units/month), lease ($/mo at
  // national-average rent), fixed (other monthly fixed cost), toll ($ per capacity unit for
  // contract manufacturers — no staff needed), staffed, life (years), cover (people a
  // location serves, for location-based businesses).
  const INDUSTRIES = [
    {
      id: 'snacks', name: 'Snack Foods', sector: 'Consumer packaged goods', capital: 'Low',
      blurb: 'Start with a co-packer making one chip, fight for shelf space, then build your own plants.',
      reach: { mode: 'sales', base: 0, perRep: 6e5, init: 0.12, max: 0.95, channels: true }, shareCap: 0.5, cpp: 9, decay: 0.03,
      lag: 1, cyc: 0.3, retail: false, freightShare: 0.35, qDecay: 0.12, freightSens: 1, storable: true,
      wages: { ops: 46000, rd: 95000 }, opsName: 'Plant crew', rdName: 'Food scientists', rdPerM: 0.12, revMult: 1.8, ebitdaMult: 12,
      regionCost: [0, 40000, 2500000, 6000000], regionNote: ['', 'Slotting fees & distributor onboarding', 'National broker network & slotting', 'Import registration & distributors'],
      season: [0.92, 0.9, 0.97, 1.0, 1.04, 1.08, 1.1, 1.06, 1.0, 0.98, 0.97, 1.0], tourismSens: 0.3,
      competitors: ['Frito-Lay', 'Utz Brands', 'Kettle Brand', 'Private label'],
      products: [
        { id: 'chips', name: 'Kettle potato chips', unit: 'bag', price: 2.40, el: 1.8, bom: { potato: 0.55, vegoil: 0.1, film: 1, carton: 0.083 }, labor: 0.004, kwh: 0.12, var: 0.52, perCap: 0.20, unlock: 0, q0: 52 },
        { id: 'macbar', name: 'Macadamia protein bars', unit: 'bar', price: 1.35, el: 1.6, bom: { flour: 0.05, macnut: 0.04, sugar: 0.03, film: 1, carton: 0.042 }, labor: 0.003, kwh: 0.05, var: 0.30, perCap: 0.25, unlock: 150, launch: 60000, q0: 50 },
        { id: 'choc', name: 'Craft chocolate bars', unit: 'bar', price: 2.80, el: 1.5, bom: { cocoa: 0.12, sugar: 0.08, film: 1, carton: 0.083 }, labor: 0.005, kwh: 0.08, var: 0.70, perCap: 0.12, unlock: 400, launch: 150000, q0: 50 }
      ],
      facilities: [
        { id: 'copack', name: 'Co-packer contract', capex: 15000, build: 1, cap: 30000, lease: 0, fixed: 2500, toll: 0.45, staffed: false, life: 3 },
        { id: 'small', name: 'Small production facility (12k sq ft)', capex: 900000, build: 4, cap: 180000, lease: 12000, fixed: 6000, staffed: true, life: 15 },
        { id: 'plant', name: 'Regional plant (120k sq ft)', capex: 18e6, build: 10, cap: 2.5e6, lease: 90000, fixed: 60000, staffed: true, life: 20 },
        { id: 'mega', name: 'High-speed national plant', capex: 95e6, build: 16, cap: 14e6, lease: 0, fixed: 350000, staffed: true, life: 25 }
      ]
    },
    {
      id: 'beverage', name: 'Beverages', sector: 'Consumer packaged goods', capital: 'Low–Medium',
      blurb: 'Craft soda first, then energy drinks and cold brew. Cans, sugar and CO2 drive your cost.',
      reach: { mode: 'sales', base: 0, perRep: 7e5, init: 0.12, max: 0.95, channels: true }, shareCap: 0.45, cpp: 10, decay: 0.03,
      lag: 1, cyc: 0.35, retail: false, freightShare: 0.55, qDecay: 0.12, freightSens: 1, storable: true,
      wages: { ops: 47000, rd: 95000 }, opsName: 'Plant crew', rdName: 'Beverage R&D', rdPerM: 0.1, revMult: 2.2, ebitdaMult: 14,
      regionCost: [0, 50000, 3000000, 7000000], regionNote: ['', 'Distributor agreements', 'National DSD & slotting', 'Export registration'],
      season: [0.82, 0.84, 0.94, 1.0, 1.1, 1.2, 1.24, 1.2, 1.04, 0.94, 0.84, 0.86], tourismSens: 0.4,
      competitors: ['Coca-Cola', 'PepsiCo', 'Celsius', 'Olipop'],
      products: [
        { id: 'soda', name: 'Craft soda (12 oz can)', unit: 'can', price: 0.95, el: 1.7, bom: { alcan: 1, sugar: 0.08, co2: 0.02, flavor: 0.0015, carton: 0.042 }, labor: 0.0012, kwh: 0.03, var: 0.20, perCap: 0.45, unlock: 0, q0: 52 },
        { id: 'energy', name: 'Energy drink (16 oz can)', unit: 'can', price: 1.80, el: 1.6, bom: { alcan: 1.1, sugar: 0.1, co2: 0.02, flavor: 0.004, carton: 0.042 }, labor: 0.0013, kwh: 0.035, var: 0.36, perCap: 0.45, unlock: 120, launch: 120000, q0: 50 },
        { id: 'coldbrew', name: 'Bottled cold brew', unit: 'bottle', price: 2.60, el: 1.5, bom: { glass: 1, coffee: 0.09, carton: 0.083 }, labor: 0.002, kwh: 0.05, var: 0.50, perCap: 0.18, unlock: 300, launch: 150000, q0: 50 }
      ],
      facilities: [
        { id: 'copack', name: 'Co-packer canning contract', capex: 20000, build: 1, cap: 60000, lease: 0, fixed: 4000, toll: 0.14, staffed: false, life: 3 },
        { id: 'line', name: 'Canning line & brewhouse (20k sq ft)', capex: 2.2e6, build: 5, cap: 900000, lease: 18000, fixed: 10000, staffed: true, life: 15 },
        { id: 'plant', name: 'Regional bottling plant', capex: 35e6, build: 12, cap: 12e6, lease: 120000, fixed: 120000, staffed: true, life: 20 },
        { id: 'mega', name: 'National mega-plant', capex: 160e6, build: 18, cap: 70e6, lease: 0, fixed: 600000, staffed: true, life: 25 }
      ]
    },
    {
      id: 'beauty', name: 'Beauty & Personal Care', sector: 'Consumer packaged goods', capital: 'Low',
      blurb: 'Reef-safe sunscreen, then skincare and haircare. High gross margins, expensive customer acquisition.',
      reach: { mode: 'sales', base: 0.03, perRep: 7e5, init: 0.12, max: 0.95, channels: true }, shareCap: 0.4, cpp: 12, decay: 0.035,
      lag: 1, cyc: 0.5, retail: false, freightShare: 0.2, qDecay: 0.15, freightSens: 0.6, storable: true,
      wages: { ops: 45000, rd: 105000 }, opsName: 'Fill & pack crew', rdName: 'Cosmetic chemists', rdPerM: 0.2, revMult: 3.0, ebitdaMult: 16,
      regionCost: [0, 40000, 2000000, 5000000], regionNote: ['', 'Retail onboarding', 'National retail + FDA OTC monograph compliance', 'EU/Asia registration'],
      season: [0.8, 0.82, 0.95, 1.05, 1.15, 1.25, 1.25, 1.15, 0.95, 0.88, 0.85, 0.9], tourismSens: 0.5,
      competitors: ['L\'Oréal', 'Neutrogena', 'Supergoop!', 'The Ordinary'],
      products: [
        { id: 'sunscreen', name: 'Reef-safe mineral sunscreen', unit: 'tube', price: 7.50, el: 1.4, bom: { glycerin: 0.15, actives: 0.8, jars: 1, carton: 0.042 }, labor: 0.01, kwh: 0.1, var: 1.4, perCap: 0.05, unlock: 0, q0: 52 },
        { id: 'serum', name: 'Skincare serum', unit: 'bottle', price: 14.0, el: 1.3, bom: { actives: 1.5, glycerin: 0.05, jars: 1, carton: 0.042 }, labor: 0.012, kwh: 0.1, var: 2.5, perCap: 0.04, unlock: 200, launch: 200000, q0: 50 },
        { id: 'hair', name: 'Haircare line', unit: 'bottle', price: 5.80, el: 1.5, bom: { glycerin: 0.3, actives: 0.4, jars: 1, carton: 0.042 }, labor: 0.008, kwh: 0.1, var: 1.2, perCap: 0.1, unlock: 450, launch: 250000, q0: 50 }
      ],
      facilities: [
        { id: 'contract', name: 'Private-label contract manufacturer', capex: 25000, build: 1, cap: 8000, lease: 0, fixed: 3000, toll: 1.10, staffed: false, life: 3 },
        { id: 'lab', name: 'Lab & filling facility', capex: 1.2e6, build: 5, cap: 120000, lease: 14000, fixed: 8000, staffed: true, life: 15 },
        { id: 'plant', name: 'Regional cosmetics plant', capex: 22e6, build: 12, cap: 1.6e6, lease: 80000, fixed: 70000, staffed: true, life: 20 },
        { id: 'hub', name: 'Global manufacturing hub', capex: 110e6, build: 18, cap: 9e6, lease: 0, fixed: 350000, staffed: true, life: 25 }
      ]
    },
    {
      id: 'apparel', name: 'Apparel & Footwear', sector: 'Consumer packaged goods', capital: 'Low–Medium',
      blurb: 'Resortwear, then activewear and sneakers. Fabric, sewing labor and tariffs decide your margins.',
      reach: { mode: 'sales', base: 0.03, perRep: 6e5, init: 0.12, max: 0.95, channels: true }, shareCap: 0.4, cpp: 12, decay: 0.035,
      lag: 1, cyc: 1.0, retail: false, freightShare: 0.2, qDecay: 0.2, freightSens: 0.5, storable: true,
      wages: { ops: 40000, rd: 100000 }, opsName: 'Sewing & warehouse staff', rdName: 'Designers', rdPerM: 0.15, revMult: 1.6, ebitdaMult: 11,
      regionCost: [0, 40000, 2200000, 5500000], regionNote: ['', 'Boutique & department store accounts', 'National wholesale + e-commerce fulfillment', 'International distributors'],
      season: [0.8, 0.82, 0.95, 1.0, 1.05, 1.05, 1.0, 1.02, 1.0, 1.02, 1.15, 1.3], tourismSens: 0.4,
      competitors: ['Nike', 'Lululemon', 'Reyn Spooner', 'Shein'],
      products: [
        { id: 'resort', name: 'Aloha shirts & resortwear', unit: 'piece', price: 30, el: 1.5, bom: { cotton: 1.8, trims: 1, carton: 0.042 }, labor: 0.25, kwh: 0.4, var: 4, perCap: 0.015, unlock: 0, q0: 52 },
        { id: 'active', name: 'Activewear', unit: 'piece', price: 27, el: 1.5, bom: { poly: 1.4, trims: 1, carton: 0.042 }, labor: 0.22, kwh: 0.4, var: 4, perCap: 0.03, unlock: 150, launch: 120000, q0: 50 },
        { id: 'sneaker', name: 'Sneakers', unit: 'pair', price: 58, el: 1.4, bom: { soles: 1, poly: 0.6, trims: 2, carton: 0.083 }, labor: 0.6, kwh: 0.8, var: 7, perCap: 0.012, unlock: 500, launch: 400000, q0: 48 }
      ],
      facilities: [
        { id: 'contract', name: 'Domestic cut-and-sew contractor', capex: 10000, build: 1, cap: 3000, lease: 0, fixed: 2000, toll: 7.5, staffed: false, life: 3 },
        { id: 'cmt', name: 'Overseas factory contract (Vietnam)', capex: 60000, build: 2, cap: 40000, lease: 0, fixed: 8000, toll: 3.4, staffed: false, life: 3, offshore: true },
        { id: 'factory', name: 'Own sewing factory + DC', capex: 2.5e6, build: 6, cap: 60000, lease: 20000, fixed: 12000, staffed: true, life: 15 },
        { id: 'network', name: 'Factory & distribution network', capex: 40e6, build: 12, cap: 900000, lease: 150000, fixed: 120000, staffed: true, life: 20 }
      ]
    },
    {
      id: 'restaurants', name: 'Restaurants & Cafés', sector: 'Food & hospitality', capital: 'Medium',
      blurb: 'Start with a food truck selling plate lunches and poke, open locations, expand the menu, build a chain.',
      reach: { mode: 'locations', base: 0, perRep: 0, init: 0, max: 0.95 }, shareCap: 0.30, cpp: 6, decay: 0.03,
      lag: 0, cyc: 0.6, retail: true, freightShare: 0, qDecay: 0.15, freightSens: 0, storable: false,
      wages: { ops: 36000, rd: 85000 }, opsName: 'Kitchen & front-of-house crew', rdName: 'Culinary team', rdPerM: 0.03, revMult: 1.5, ebitdaMult: 11,
      regionCost: [0, 25000, 900000, 3000000], regionNote: ['', 'Permits & health licensing', 'Multi-state franchise disclosure & supply contracts', 'International master franchise'],
      season: [0.95, 0.95, 1.0, 1.0, 1.02, 1.04, 1.06, 1.05, 0.98, 0.98, 0.98, 1.0], tourismSens: 0.35,
      competitors: ['L&L Hawaiian Barbecue', 'Chipotle', 'Starbucks', 'Independent restaurants'],
      products: [
        { id: 'plate', name: 'Plate lunches & poke bowls', unit: 'meal', price: 15.5, el: 1.6, bom: { chicken: 0.3, fish: 0.1, rice: 0.3, produce: 0.25 }, labor: 0.13, kwh: 0.4, var: 1.0, perCap: 3.0, unlock: 0, q0: 55 },
        { id: 'coffee', name: 'Coffee & pastries', unit: 'order', price: 6.2, el: 1.5, bom: { coffee: 0.04, dairy: 0.06, flour: 0.1, sugar: 0.05 }, labor: 0.05, kwh: 0.15, var: 0.9, perCap: 4.0, unlock: 80, launch: 40000, q0: 50 },
        { id: 'burger', name: 'Burgers & fries', unit: 'meal', price: 13, el: 1.6, bom: { beef: 0.35, potato: 0.4, vegoil: 0.1, produce: 0.1, flour: 0.15 }, labor: 0.12, kwh: 0.45, var: 1.2, perCap: 4.0, unlock: 250, launch: 80000, q0: 50 }
      ],
      facilities: [
        { id: 'truck', name: 'Food truck', capex: 140000, build: 2, cap: 7000, lease: 1500, fixed: 3000, staffed: true, life: 7, cover: 60000 },
        { id: 'counter', name: 'Counter-service restaurant (2,200 sq ft)', capex: 650000, build: 4, cap: 22000, lease: 9000, fixed: 7000, staffed: true, life: 10, cover: 120000 },
        { id: 'flagship', name: 'Drive-thru flagship', capex: 1.8e6, build: 6, cap: 45000, lease: 14000, fixed: 12000, staffed: true, life: 15, cover: 200000 },
        { id: 'cluster', name: 'Market cluster (10 restaurants + commissary)', capex: 8.5e6, build: 9, cap: 260000, lease: 95000, fixed: 80000, staffed: true, life: 12, cover: 1500000 }
      ]
    },
    {
      id: 'saas', b2b: true, name: 'B2B Software (SaaS)', sector: 'Technology', capital: 'Low (but talent-hungry)',
      blurb: 'Ship an MVP to small businesses, climb to mid-market and enterprise. Engineers and churn are everything.',
      reach: { mode: 'sales', base: 0.3, perRep: 2.5e6, init: 0.3, max: 0.95 }, shareCap: 0.12, cpp: 8, decay: 0.03,
      lag: 0, cyc: 0.6, retail: false, freightShare: 0, qDecay: 0.45, freightSens: 0, storable: false, recurring: true,
      wages: { ops: 60000, rd: 155000 }, opsName: 'DevOps', rdName: 'Software engineers', rdPerM: 0.9, revMult: 7, ebitdaMult: 25,
      regionCost: [0, 15000, 250000, 1500000], regionNote: ['', 'Sales territory', 'SOC 2 Type II + national sales team', 'GDPR, EU data residency'],
      season: FLAT, tourismSens: 0,
      competitors: ['Salesforce', 'HubSpot', 'Microsoft', 'Vertical SaaS startups'],
      products: [
        { id: 'starter', name: 'SMB Starter plan', unit: 'subscription', price: 59, el: 1.2, bom: { cloud: 0.1 }, labor: 0, kwh: 0, var: 3, perCap: 0.09, unlock: 0, q0: 42, recurring: { churn: 0.035, support: 1500 } },
        { id: 'business', name: 'Business plan', unit: 'subscription', price: 450, el: 1.1, bom: { cloud: 1.2 }, labor: 0, kwh: 0, var: 20, perCap: 0.004, unlock: 100, launch: 50000, q0: 45, recurring: { churn: 0.018, support: 150 } },
        { id: 'enterprise', name: 'Enterprise plan', unit: 'subscription', price: 7500, el: 1.0, bom: { cloud: 12 }, labor: 0, kwh: 0, var: 200, perCap: 0.00008, unlock: 400, launch: 250000, q0: 45, recurring: { churn: 0.008, support: 15 } }
      ],
      facilities: []
    },
    {
      id: 'fintech', name: 'Consumer Fintech', sector: 'Technology', capital: 'Medium',
      blurb: 'A budgeting app, then a debit card and small-business lending. Regulators and credit losses are the risk.',
      reach: { mode: 'sales', base: 0.55, perRep: 5e6, init: 0.55, max: 0.95 }, shareCap: 0.2, cpp: 7, decay: 0.035,
      lag: 0, cyc: 0.7, retail: false, freightShare: 0, qDecay: 0.4, freightSens: 0, storable: false, recurring: true,
      wages: { ops: 65000, rd: 150000 }, opsName: 'Risk & operations', rdName: 'Engineers', rdPerM: 0.7, revMult: 5, ebitdaMult: 18,
      regionCost: [0, 150000, 1800000, 4000000], regionNote: ['', 'State money transmitter license', 'Money transmitter licenses in 49 states', 'E-money licenses abroad'],
      season: FLAT, tourismSens: 0,
      competitors: ['Chime', 'Cash App', 'SoFi', 'Big banks'],
      products: [
        { id: 'app', name: 'Premium budgeting app', unit: 'member', price: 6.99, el: 1.4, bom: { cloud: 0.02 }, labor: 0, kwh: 0, var: 0.6, perCap: 0.25, unlock: 0, q0: 45, recurring: { churn: 0.04, support: 5000 } },
        { id: 'card', name: 'Debit card & banking', unit: 'cardholder', price: 9, el: 1.3, bom: { cloud: 0.03 }, labor: 0, kwh: 0, var: 3, varEcon: true, perCap: 0.2, unlock: 150, launch: 600000, q0: 45, recurring: { churn: 0.025, support: 3000 } },
        { id: 'lending', name: 'Small-business lending', unit: 'borrower', price: 85, el: 1.1, bom: { cloud: 0.05 }, labor: 0, kwh: 0, var: 25, varEcon: true, perCap: 0.01, unlock: 400, launch: 1.5e6, q0: 45, recurring: { churn: 0.03, support: 400 } }
      ],
      facilities: []
    },
    {
      id: 'electronics', name: 'Consumer Electronics', sector: 'Technology', capital: 'Medium',
      blurb: 'Earbuds built by a contract manufacturer, then smart-home and tablets. Chips, tariffs and Q4 decide the year.',
      reach: { mode: 'sales', base: 0.03, perRep: 9e5, init: 0.1, max: 0.95, channels: true }, shareCap: 0.35, cpp: 12, decay: 0.035,
      lag: 1, cyc: 0.9, retail: false, freightShare: 0.15, qDecay: 0.4, freightSens: 0.4, storable: true,
      wages: { ops: 48000, rd: 145000 }, opsName: 'Assembly & test', rdName: 'Hardware engineers', rdPerM: 0.5, revMult: 2.2, ebitdaMult: 14,
      regionCost: [0, 50000, 3000000, 6000000], regionNote: ['', 'Retail accounts', 'Big-box & Amazon national + FCC certification', 'CE marking & distributors'],
      season: [0.85, 0.8, 0.85, 0.88, 0.9, 0.92, 0.95, 1.0, 1.0, 1.05, 1.35, 1.45], tourismSens: 0,
      competitors: ['Apple', 'Samsung', 'Anker', 'Sony'],
      products: [
        { id: 'buds', name: 'Wireless earbuds', unit: 'unit', price: 64, el: 1.6, bom: { semis: 0.8, cells: 0.002, pcb: 0.45 }, labor: 0.15, kwh: 0.5, var: 7, perCap: 0.012, unlock: 0, q0: 48 },
        { id: 'hub', name: 'Smart-home hub', unit: 'unit', price: 98, el: 1.5, bom: { semis: 1.5, pcb: 1, display: 0.3 }, labor: 0.2, kwh: 0.6, var: 10, perCap: 0.005, unlock: 200, launch: 500000, q0: 48 },
        { id: 'tablet', name: 'Tablet', unit: 'unit', price: 265, el: 1.5, bom: { semis: 3, display: 1, cells: 0.03, pcb: 2 }, labor: 0.5, kwh: 1.2, var: 25, perCap: 0.006, unlock: 600, launch: 2e6, q0: 46 }
      ],
      facilities: [
        { id: 'ems', name: 'Contract manufacturer (Shenzhen EMS)', capex: 150000, build: 2, cap: 15000, lease: 0, fixed: 10000, toll: 4, staffed: false, life: 3, offshore: true },
        { id: 'mx', name: 'Contract assembly (Monterrey, MX)', capex: 400000, build: 3, cap: 60000, lease: 0, fixed: 25000, toll: 5.5, staffed: false, life: 3 },
        { id: 'plant', name: 'Own assembly plant', capex: 15e6, build: 9, cap: 250000, lease: 60000, fixed: 80000, staffed: true, life: 12 },
        { id: 'campus', name: 'Advanced manufacturing campus', capex: 400e6, build: 20, cap: 3e6, lease: 0, fixed: 1.2e6, staffed: true, life: 20 }
      ]
    },
    {
      id: 'solar', name: 'Residential Solar & Storage', sector: 'Green tech', capital: 'Low–Medium',
      blurb: 'Rooftop solar installs, then home batteries and commercial projects. Power prices drive demand; modules and crews drive cost.',
      reach: { mode: 'sales', base: 0, perRep: 3e5, init: 0.1, max: 0.9 }, shareCap: 0.35, cpp: 10, decay: 0.03,
      lag: 1, cyc: 0.8, retail: true, freightShare: 0.1, qDecay: 0.12, freightSens: 0.3, storable: false, elecSens: 1.2,
      wages: { ops: 55000, rd: 120000 }, opsName: 'Install crews (NABCEP)', rdName: 'Engineering & design', rdPerM: 0.08, revMult: 1.4, ebitdaMult: 10,
      regionCost: [0, 60000, 1500000, 5000000], regionNote: ['', 'Contractor licenses & utility interconnection', 'Licensing in every state', 'International subsidiaries'],
      season: [0.8, 0.85, 1.0, 1.1, 1.12, 1.1, 1.05, 1.05, 1.05, 1.0, 0.95, 0.9], tourismSens: 0,
      competitors: ['Sunrun', 'Tesla Energy', 'SunPower dealers', 'Local installers'],
      products: [
        { id: 'rooftop', name: 'Rooftop solar system (8 kW)', unit: 'system', price: 26000, el: 1.4, bom: { modules: 8000, inverter: 8000, racking: 8000 }, labor: 60, kwh: 0, var: 3800, capW: 1, perCap: 0.00011, unlock: 0, q0: 52 },
        { id: 'battery', name: 'Home battery (13.5 kWh)', unit: 'system', price: 14000, el: 1.3, bom: { cells: 13.5, inverter: 5000 }, labor: 16, kwh: 0, var: 2000, capW: 0.3, perCap: 0.00006, unlock: 100, launch: 80000, q0: 50 },
        { id: 'commercial', name: 'Commercial solar (250 kW)', unit: 'project', price: 525000, el: 1.2, bom: { modules: 250000, inverter: 250000, racking: 250000 }, labor: 900, kwh: 0, var: 70000, capW: 25, perCap: 0.0000008, unlock: 400, launch: 300000, q0: 50 }
      ],
      facilities: [
        { id: 'base', name: 'Warehouse & crew base', capex: 250000, build: 2, cap: 25, lease: 6000, fixed: 4000, staffed: true, life: 10 },
        { id: 'hub', name: 'Regional install hub', capex: 2.5e6, build: 4, cap: 250, lease: 30000, fixed: 25000, staffed: true, life: 12 },
        { id: 'ops', name: 'National operations center', capex: 30e6, build: 9, cap: 3000, lease: 200000, fixed: 200000, staffed: true, life: 15 }
      ]
    },
    {
      id: 'ev', name: 'Electric Vehicles & E-Mobility', sector: 'Green tech', capital: 'High',
      blurb: 'Build e-bikes in a workshop, earn your way to a compact EV and a gigafactory. Battery cells are your biggest cost.',
      reach: { mode: 'sales', base: 0.05, perRep: 1.5e6, init: 0.1, max: 0.9 }, shareCap: 0.35, cpp: 14, decay: 0.03,
      lag: 0, cyc: 1.0, retail: true, freightShare: 0.15, qDecay: 0.3, freightSens: 0.5, storable: true,
      wages: { ops: 52000, rd: 140000 }, opsName: 'Production line', rdName: 'Vehicle engineers', rdPerM: 0.6, revMult: 2.5, ebitdaMult: 14,
      regionCost: [0, 60000, 2500000, 8000000], regionNote: ['', 'Dealer/showroom licensing', 'FMVSS/NHTSA compliance + service network', 'Homologation abroad'],
      season: [0.85, 0.85, 1.0, 1.1, 1.15, 1.1, 1.05, 1.0, 1.0, 0.95, 0.95, 1.05], tourismSens: 0,
      competitors: ['Tesla', 'Rivian', 'Rad Power Bikes', 'GM / Ford EV'],
      products: [
        { id: 'ebike', name: 'E-bikes', unit: 'bike', price: 1450, el: 1.5, bom: { cells: 0.6, aluminum: 22, semis: 2, copper: 3, pcb: 4 }, labor: 4, kwh: 15, var: 220, capW: 1, perCap: 0.0004, unlock: 0, q0: 50 },
        { id: 'compact', name: 'Compact EV', unit: 'vehicle', price: 34000, el: 1.4, bom: { cells: 60, steel: 0.9, aluminum: 400, copper: 80, semis: 40, pcb: 60, display: 2 }, labor: 30, kwh: 900, var: 14000, capW: 40, perCap: 0.00008, unlock: 800, launch: 25e6, q0: 45 },
        { id: 'suv', name: 'Electric SUV / pickup', unit: 'vehicle', price: 58000, el: 1.3, bom: { cells: 100, steel: 1.3, aluminum: 650, copper: 110, semis: 60, pcb: 80, display: 3 }, labor: 40, kwh: 1300, var: 20000, capW: 55, perCap: 0.00008, unlock: 2000, launch: 80e6, q0: 45 }
      ],
      facilities: [
        { id: 'oem', name: 'Contract e-bike assembly (Taiwan OEM)', capex: 40000, build: 2, cap: 400, lease: 0, fixed: 3000, toll: 160, staffed: false, life: 3, offshore: true },
        { id: 'workshop', name: 'E-bike assembly workshop', capex: 400000, build: 3, cap: 1500, lease: 8000, fixed: 6000, staffed: true, life: 10 },
        { id: 'line', name: 'E-mobility assembly line', capex: 12e6, build: 8, cap: 25000, lease: 50000, fixed: 60000, staffed: true, life: 15 },
        { id: 'pilot', name: 'EV pilot plant', capex: 250e6, build: 18, cap: 80000, lease: 0, fixed: 1.5e6, staffed: true, life: 20 },
        { id: 'giga', name: 'Gigafactory', capex: 3.5e9, build: 30, cap: 2e6, lease: 0, fixed: 18e6, staffed: true, life: 25 }
      ]
    },
    {
      id: 'power', name: 'Renewable Power Producer', sector: 'Energy', capital: 'High',
      blurb: 'Lease rooftops for commercial solar, then build solar farms, wind and batteries. You sell power at the local wholesale price.',
      reach: { mode: 'none' }, shareCap: 1, cpp: 0, decay: 0, lag: 1, cyc: 0.1, retail: false, freightShare: 0, qDecay: 0.05, freightSens: 0, storable: false,
      wages: { ops: 75000, rd: 140000 }, opsName: 'Plant technicians', rdName: 'Project engineers', rdPerM: 0.1, revMult: 4, ebitdaMult: 11,
      regionCost: [0, 0, 0, 0], season: FLAT, tourismSens: 0, priceTaker: true, siteAnywhere: true,
      competitors: ['NextEra', 'Brookfield Renewable', 'AES', 'Local utility'],
      products: [
        { id: 'mwh', name: 'Electricity', unit: 'MWh', market: 'ppa', var: 2, royalty: 0, q0: 60 },
        { id: 'grid', name: 'Capacity & grid services', unit: 'MW-month', market: 'capacity', var: 150, royalty: 0, q0: 60 }
      ],
      facilities: [
        { id: 'rooftop', name: 'Commercial rooftop solar (250 kW)', capex: 400000, build: 3, mw: 0.25, tech: 'solar', lease: 500, fixed: 600, staffed: false, crew: 0, life: 25 },
        { id: 'community', name: 'Community solar garden (2 MW)', capex: 3.2e6, build: 6, mw: 2, tech: 'solar', lease: 2500, fixed: 2500, staffed: true, crew: 0.2, life: 30 },
        { id: 'utility', name: 'Utility-scale solar farm (100 MW)', capex: 115e6, build: 18, mw: 100, tech: 'solar', lease: 40000, fixed: 120000, staffed: true, crew: 4, life: 30 },
        { id: 'wind', name: 'Wind farm (150 MW)', capex: 240e6, build: 24, mw: 150, tech: 'wind', lease: 60000, fixed: 300000, staffed: true, crew: 8, life: 25 },
        { id: 'bess', name: 'Battery storage (50 MW / 200 MWh)', capex: 55e6, build: 12, mw: 50, tech: 'battery', lease: 10000, fixed: 60000, staffed: true, crew: 2, life: 15, itc: 0.3 },
        { id: 'peaker', name: 'Natural-gas peaker (200 MW)', capex: 210e6, build: 30, mw: 200, tech: 'gas', lease: 20000, fixed: 400000, staffed: true, crew: 18, life: 30 }
      ]
    },
    {
      id: 'oilgas', name: 'Oil & Gas (E&P)', sector: 'Energy', capital: 'High',
      blurb: 'Buy a working interest in someone else\'s well, then operate your own pads and go offshore. Price-taker on WTI and Henry Hub.',
      reach: { mode: 'none' }, shareCap: 1, cpp: 0, decay: 0, lag: 1, cyc: 0.1, retail: false, freightShare: 0, qDecay: 0.05, freightSens: 0, storable: false,
      wages: { ops: 88000, rd: 155000 }, opsName: 'Field operations', rdName: 'Petroleum engineers & geologists', rdPerM: 0.08, revMult: 2.5, ebitdaMult: 5,
      regionCost: [0, 0, 0, 0], season: FLAT, tourismSens: 0, priceTaker: true, siteResource: true,
      competitors: ['ExxonMobil', 'Diamondback', 'EOG Resources', 'Private operators'],
      products: [
        { id: 'oil', name: 'Crude oil', unit: 'bbl', market: 'crude', priceMult: 0.97, var: 11, royalty: 0.2, sevTax: 0.046, q0: 55 },
        { id: 'gas', name: 'Natural gas', unit: 'Mcf', market: 'natgas', priceMult: 0.9, var: 0.7, royalty: 0.2, sevTax: 0.075, q0: 55 }
      ],
      facilities: [
        { id: 'nonop', name: 'Non-operated working interest (12.5% of a shale well)', capex: 1.0e6, build: 3, out: { oil: 2250, gas: 4500 }, decline: 0.15, res: 'oil', lease: 0, fixed: 1500, staffed: false, crew: 0, life: 15 },
        { id: 'vertical', name: 'Conventional vertical well', capex: 1.8e6, build: 2, out: { oil: 1800, gas: 2500 }, decline: 0.04, res: 'oil', lease: 500, fixed: 4000, staffed: true, crew: 0.25, life: 20 },
        { id: 'shale', name: 'Horizontal shale well (operated)', capex: 8.5e6, build: 4, out: { oil: 19000, gas: 38000 }, decline: 0.15, res: 'oil', lease: 1500, fixed: 9000, staffed: true, crew: 0.5, life: 15 },
        { id: 'pad', name: 'Multi-well pad (6 wells)', capex: 46e6, build: 6, out: { oil: 114000, gas: 228000 }, decline: 0.15, res: 'oil', lease: 6000, fixed: 45000, staffed: true, crew: 2, life: 15 },
        { id: 'gaswell', name: 'Dry-gas well (Marcellus-style)', capex: 9e6, build: 4, out: { oil: 0, gas: 600000 }, decline: 0.08, res: 'gas', lease: 1500, fixed: 8000, staffed: true, crew: 0.5, life: 20 },
        { id: 'deep', name: 'Deepwater platform (Gulf of Mexico)', capex: 2.2e9, build: 36, out: { oil: 900000, gas: 900000 }, decline: 0.012, res: 'offshore', lease: 0, fixed: 9e6, staffed: true, crew: 120, life: 25 }
      ]
    },
    {
      id: 'airline', name: 'Airline', sector: 'Transportation', capital: 'High',
      blurb: 'Start like a commuter carrier with one leased Cessna Caravan, add turboprops, then jets and long-haul routes.',
      reach: { mode: 'locations', base: 0, perRep: 0, init: 0, max: 0.95 }, shareCap: 0.4, cpp: 6, decay: 0.03,
      lag: 0, cyc: 0.9, retail: true, freightShare: 0, qDecay: 0.12, freightSens: 0, storable: false,
      wages: { ops: 92000, rd: 130000 }, opsName: 'Pilots, crew & mechanics', rdName: 'Network & certification team', rdPerM: 0.05, revMult: 0.8, ebitdaMult: 6,
      regionCost: [0, 150000, 2500000, 8000000], regionNote: ['', 'Part 135 commuter certificate', 'Part 121 certificate + airport slots', 'Foreign carrier permits & ETOPS'],
      season: [0.9, 0.85, 1.0, 0.95, 0.95, 1.1, 1.18, 1.12, 0.92, 0.95, 0.98, 1.12], tourismSens: 0.75,
      competitors: ['Hawaiian / Alaska', 'Southwest', 'United', 'Mokulele-style commuters'],
      products: [
        { id: 'short', name: 'Short-haul seats', unit: 'passenger', price: 129, el: 1.3, bom: { jetfuel: 4.2 }, labor: 0.22, kwh: 0, var: 30, capW: 1.2, perCap: 0.08, unlock: 0, q0: 55, tourismX: 3.3 },
        { id: 'cargo', name: 'Air cargo', unit: '100 lb', price: 85, el: 1.1, bom: { jetfuel: 3 }, labor: 0.1, kwh: 0, var: 10, capW: 0.4, perCap: 0.06, unlock: 120, launch: 250000, q0: 50 },
        { id: 'long', name: 'Long-haul seats', unit: 'passenger', price: 480, el: 1.2, bom: { jetfuel: 19 }, labor: 0.9, kwh: 0, var: 72, capW: 5.5, perCap: 0.04, unlock: 300, launch: 3e6, q0: 50, tourismX: 1.5 }
      ],
      facilities: [
        { id: 'caravan', name: 'Cessna Caravan, 9 seats (leased)', capex: 120000, build: 2, cap: 2700, lease: 38000, fixed: 25000, staffed: true, life: 5, cover: 150000, noRent: true },
        { id: 'atr', name: 'ATR 72-600 turboprop (leased)', capex: 600000, build: 3, cap: 23100, lease: 165000, fixed: 90000, staffed: true, life: 8, cover: 400000, noRent: true },
        { id: 'a321', name: 'Airbus A321neo (leased)', capex: 3e6, build: 4, cap: 70560, lease: 380000, fixed: 220000, staffed: true, life: 10, cover: 1.2e6, noRent: true },
        { id: 'b787', name: 'Boeing 787-9 (leased)', capex: 12e6, build: 6, cap: 121800, lease: 1000000, fixed: 700000, staffed: true, life: 12, cover: 3e6, noRent: true }
      ]
    },
    {
      id: 'logistics', b2b: true, name: 'Trucking & Logistics', sector: 'Transportation', capital: 'Medium',
      blurb: 'A box truck and a van, then truck fleets, a terminal network and last-mile delivery. Diesel and drivers are the business.',
      reach: { mode: 'sales', base: 0.05, perRep: 1e6, init: 0.12, max: 0.9 }, shareCap: 0.35, cpp: 10, decay: 0.03,
      lag: 1, cyc: 1.0, retail: false, freightShare: 0, qDecay: 0.12, freightSens: 0, storable: false,
      wages: { ops: 64000, rd: 130000 }, opsName: 'Drivers & dock workers', rdName: 'Routing & software team', rdPerM: 0.1, revMult: 0.9, ebitdaMult: 8,
      regionCost: [0, 30000, 600000, 4000000], regionNote: ['', 'Intrastate authority & insurance', 'USDOT/MC interstate authority', 'Cross-border operations'],
      season: [0.92, 0.92, 0.98, 1.0, 1.02, 1.02, 1.0, 1.0, 1.02, 1.05, 1.08, 1.06], tourismSens: 0,
      competitors: ['J.B. Hunt', 'Old Dominion', 'UPS / FedEx', 'Small fleets'],
      products: [
        { id: 'ftl', name: 'Full truckload (FTL)', unit: 'load', price: 3100, el: 1.6, bom: { diesel: 155 }, labor: 12, kwh: 0, var: 320, capW: 1, perCap: 0.006, unlock: 0, q0: 52 },
        { id: 'ltl', name: 'Less-than-truckload (LTL)', unit: 'shipment', price: 480, el: 1.4, bom: { diesel: 18 }, labor: 2.2, kwh: 0, var: 60, capW: 0.15, perCap: 0.01, unlock: 120, launch: 400000, q0: 50 },
        { id: 'parcel', name: 'Last-mile parcel delivery', unit: 'package', price: 10.5, el: 1.5, bom: { diesel: 0.25 }, labor: 0.045, kwh: 0, var: 1.4, capW: 0.004, perCap: 0.9, unlock: 300, launch: 1e6, q0: 50 }
      ],
      facilities: [
        { id: 'van', name: 'Box truck & cargo van (leased)', capex: 15000, build: 1, cap: 14, lease: 2800, fixed: 1500, staffed: true, life: 5, noRent: true },
        { id: 'fleet', name: 'Tractor-trailer fleet (10 trucks)', capex: 1.7e6, build: 2, cap: 100, lease: 2000, fixed: 25000, staffed: true, life: 7 },
        { id: 'terminal', name: 'Cross-dock terminal + 60 trucks', capex: 14e6, build: 6, cap: 650, lease: 40000, fixed: 150000, staffed: true, life: 10 },
        { id: 'hub', name: 'National hub (300 trucks + sortation)', capex: 85e6, build: 12, cap: 3500, lease: 150000, fixed: 800000, staffed: true, life: 12 }
      ]
    },
    {
      id: 'datacenter', b2b: true, name: 'Cloud & AI Data Centers', sector: 'Technology', capital: 'Very high',
      blurb: 'Resell rented GPUs, then run your own cages, data halls and a hyperscale campus. Electricity prices make or break you.',
      reach: { mode: 'sales', base: 0.2, perRep: 6e6, init: 0.2, max: 0.95 }, shareCap: 0.3, cpp: 8, decay: 0.03,
      lag: 1, cyc: 0.5, retail: false, freightShare: 0, qDecay: 0.3, freightSens: 0, storable: false, siteAnywhere: true,
      wages: { ops: 75000, rd: 165000 }, opsName: 'Data center technicians', rdName: 'Infrastructure engineers', rdPerM: 0.25, revMult: 6, ebitdaMult: 18,
      regionCost: [0, 20000, 400000, 3000000], regionNote: ['', 'Regional sales', 'National enterprise sales + FedRAMP', 'International data residency'],
      season: FLAT, tourismSens: 0,
      competitors: ['AWS', 'CoreWeave', 'Equinix', 'Google Cloud'],
      products: [
        { id: 'gpu', name: 'GPU cloud', unit: 'GPU-hour', price: 2.40, el: 1.5, bom: {}, labor: 0.0004, kwh: 1.0, var: 0.25, capW: 1, perCap: 0.15, growth: 0.025, unlock: 0, q0: 50 },
        { id: 'colo', name: 'Colocation', unit: 'kW-month', price: 165, el: 1.3, bom: {}, labor: 0.2, kwh: 985, var: 15, capW: 700, perCap: 0.004, unlock: 80, launch: 200000, q0: 50 },
        { id: 'inference', name: 'Inference API', unit: '1M tokens', price: 1.20, el: 1.6, bom: {}, labor: 0, kwh: 0.12, var: 0.08, capW: 0.1, perCap: 0.8, growth: 0.04, unlock: 250, launch: 500000, q0: 50 }
      ],
      facilities: [
        { id: 'resell', name: 'Wholesale GPU reseller contract (64 GPUs)', capex: 50000, build: 1, cap: 46720, lease: 0, fixed: 3000, toll: 1.55, staffed: false, life: 2, noPower: true },
        { id: 'cage', name: 'Colocation cage (256 GPUs)', capex: 8.5e6, build: 3, cap: 186880, lease: 45000, fixed: 30000, staffed: true, life: 5 },
        { id: 'hall', name: 'Modular data hall (10 MW, 8,000 GPUs)', capex: 340e6, build: 14, cap: 5.84e6, lease: 120000, fixed: 900000, staffed: true, life: 6 },
        { id: 'campus', name: 'Hyperscale campus (200 MW)', capex: 7.5e9, build: 30, cap: 110e6, lease: 0, fixed: 15e6, staffed: true, life: 7 }
      ]
    }
  ];

  const BACKGROUNDS = [
    { id: 'manager', name: 'Corporate manager', cash: 180000, rep: 25, blurb: 'Ten years climbing a big company. Decent savings, a solid network.' },
    { id: 'engineer', name: 'Engineer', cash: 140000, rep: 20, rdBonus: 4, blurb: 'You can build the first product yourself. +R&D from the founder.' },
    { id: 'seller', name: 'Sales leader', cash: 160000, rep: 22, salesBonus: 1, blurb: 'You open doors. The founder counts as two salespeople.' },
    { id: 'serial', name: 'Serial entrepreneur', cash: 400000, rep: 40, blurb: 'One exit behind you. Investors take your calls.' },
    { id: 'grad', name: 'Recent graduate', cash: 25000, rep: 5, blurb: 'Student loans, big ideas, nothing to lose.' },
    { id: 'heir', name: 'Family money', cash: 2500000, rep: 10, blurb: 'A large inheritance and something to prove.' }
  ];

  const ROUNDS = [
    { id: 'ff', name: 'Friends & family', min: 25000, max: 250000, floor: 1.5e6, board: 0, req: () => true },
    { id: 'angel', name: 'Angel round', min: 150000, max: 1.5e6, floor: 3e6, board: 0, req: (m) => true },
    { id: 'seed', name: 'Seed (VC)', min: 1e6, max: 4e6, floor: 8e6, board: 1, req: (m) => m.runRate >= 300000 || m.rdPts >= 200 },
    { id: 'a', name: 'Series A', min: 4e6, max: 20e6, floor: 25e6, board: 1, req: (m) => m.runRate >= 2e6 && m.qGrowth >= 0.08 },
    { id: 'b', name: 'Series B', min: 15e6, max: 60e6, floor: 80e6, board: 1, req: (m) => m.runRate >= 10e6 && m.qGrowth >= 0.05 },
    { id: 'c', name: 'Series C / growth', min: 40e6, max: 250e6, floor: 250e6, board: 1, req: (m) => m.runRate >= 40e6 },
    { id: 'pe', name: 'Private equity (minority)', min: 20e6, max: 500e6, floor: 50e6, board: 2, req: (m) => m.ebitdaRun >= 5e6 },
    { id: 'ipo', name: 'IPO', min: 75e6, max: 3e9, floor: 500e6, board: 0, req: (m) => m.runRate >= 150e6 && (m.ebitdaRun > 0 || m.yGrowth > 0.4) }
  ];

  const COMPANY_WORDS = {
    a: ['Pacific', 'Summit', 'Harbor', 'Keystone', 'Meridian', 'Ironwood', 'Kalani', 'Northstar', 'Bluewater', 'Redrock', 'Lakeshore', 'Granite', 'Cascade', 'Silverline', 'Prairie', 'Coral', 'Atlas', 'Beacon', 'Mesa', 'Evergreen'],
    snacks: ['Snacks', 'Foods', 'Provisions', 'Brands'], beverage: ['Beverage Co.', 'Bottling', 'Drinks', 'Refreshments'],
    beauty: ['Beauty', 'Labs', 'Skincare', 'Botanicals'], apparel: ['Apparel', 'Outfitters', 'Threads', 'Supply Co.'],
    restaurants: ['Restaurant Group', 'Kitchens', 'Hospitality', 'Eateries'], saas: ['Software', 'Cloud', 'Systems', 'Technologies'],
    fintech: ['Financial', 'Pay', 'Money', 'Capital'], electronics: ['Devices', 'Electronics', 'Audio', 'Technologies'],
    solar: ['Solar', 'Energy Systems', 'Sun Power', 'Renewables'], ev: ['Motors', 'Mobility', 'Electric', 'Automotive'],
    power: ['Power', 'Renewables', 'Energy Partners', 'Generation'], oilgas: ['Resources', 'Energy', 'Petroleum', 'Exploration'],
    airline: ['Airlines', 'Air', 'Airways', 'Aviation'], logistics: ['Logistics', 'Freight', 'Transport', 'Express'],
    datacenter: ['Compute', 'Data Centers', 'Digital Infrastructure', 'AI Cloud']
  };


  // ---------- Marketing channels ----------
  // base = awareness bought per dollar at low spend; sat = how fast the channel saturates (higher = scales further);
  // min = spend below which the channel barely works; regions = which markets it can reach.
  const MKT_CHANNELS = [
    { id: 'social', name: 'Social media ads', b2bName: 'LinkedIn & digital ads', base: 1.15, sat: 1.0, blurb: 'Instagram, TikTok, Facebook. Efficient at small budgets, saturates as you scale.' },
    { id: 'influencer', name: 'Influencers & creators', base: 1.3, sat: 0.45, consumer: true, blurb: 'Gifting and paid posts. Cheap awareness with a small chance of going viral.' },
    { id: 'search', name: 'Search & marketplace ads', base: 0.6, sat: 0.8, blurb: 'Captures people already looking. Lifts conversion as well as awareness.' },
    { id: 'sampling', name: 'Sampling, events & festival booths', b2bName: 'Demos & customer events', base: 1.6, sat: 0.6, regions: [0, 1], blurb: 'Hands product to people. Strong locally, also helps you win retail accounts.' },
    { id: 'outdoor', name: 'Billboards, radio & print', base: 0.9, sat: 1.6, blurb: 'Broad local reach, slow to build.' },
    { id: 'tv', name: 'TV & streaming', base: 1.6, sat: 5, min: 40000, consumer: true, blurb: 'The most efficient channel at scale; wasted below about $40K a month.' },
    { id: 'trade', name: 'Trade shows & buyer meetings', base: 0.35, b2bBase: 1.3, sat: 0.7, blurb: 'Where retail buyers and B2B customers shop. Raises your odds of landing accounts.' },
    { id: 'pr', name: 'PR & sponsorships', base: 0.8, sat: 0.8, blurb: 'Surf contests, charity runs, press. Makes customers see your products as higher quality.' }
  ];
  const MKT_PRESETS = {
    local: { name: 'Bootstrap locally', mix: { social: 0.45, sampling: 0.35, influencer: 0.2 } },
    tourist: { name: 'Visitor season push', mix: { outdoor: 0.3, sampling: 0.25, influencer: 0.2, social: 0.15, pr: 0.1 } },
    retail: { name: 'Win retail buyers', mix: { trade: 0.35, sampling: 0.3, social: 0.2, pr: 0.15 } },
    national: { name: 'National launch', mix: { tv: 0.35, social: 0.2, search: 0.2, influencer: 0.1, pr: 0.15 } },
    b2b: { name: 'B2B pipeline', mix: { trade: 0.4, search: 0.3, social: 0.3 } }
  };

  // ---------- Retail accounts (consumer products) ----------
  // cover = share of that market's population the account puts you in front of; mult = price you realize vs your
  // wholesale list price; slot = one-time slotting/onboarding; fee = monthly cost; minQ = quality the buyer demands;
  // chance = base odds a pitch succeeds; lag = extra months before they pay; tour = coverage grows with visitors.
  const CPG = ['snacks', 'beverage', 'beauty', 'apparel', 'electronics'];
  const ACCOUNTS = [
    { id: 'markets', region: 0, name: 'Farmers markets & craft fairs', hnl: 'Farmers markets & craft fairs (Kakaʻako, KCC, Haleʻiwa)', cover: 0.02, mult: 1.8, fee: 400, slot: 0, minQ: 0, chance: 1, inds: CPG, note: 'You sell at retail price, in person. Tiny volume.' },
    { id: 'boutique', region: 0, name: 'Surf, gift & boutique shops (25 stores)', hnl: 'North Shore & Waikiki surf and gift shops (25 stores)', cover: 0.05, mult: 0.95, fee: 0, slot: 2000, minQ: 45, chance: 0.65, inds: CPG },
    { id: 'hotels', region: 0, name: 'Resort hotel gift shops (12 resorts)', hnl: 'Waikiki & Ko Olina resort gift shops (12 resorts)', cover: 0.05, tour: true, mult: 1.1, fee: 1200, slot: 0, minQ: 58, chance: 0.5, inds: CPG, note: 'Hotels pay well, want premium quality, and need product-liability insurance.' },
    { id: 'amenity', region: 0, name: 'Hotel amenity contract (in-room products)', cover: 0.07, tour: true, mult: 0.7, fee: 0, slot: 5000, minQ: 55, chance: 0.4, inds: ['beauty', 'snacks', 'beverage'], note: 'Big volume at a bulk discount: your product in every room or minibar.' },
    { id: 'gyms', region: 0, name: 'Gyms, yoga studios & surf schools', cover: 0.03, mult: 1.0, fee: 0, slot: 0, minQ: 50, chance: 0.6, inds: ['snacks', 'beverage', 'apparel', 'beauty'] },
    { id: 'airport', region: 0, name: 'Airport shops', hnl: 'Airport shops (HNL & neighbor-island airports)', cover: 0.03, tour: true, mult: 1.12, fee: 2500, slot: 5000, minQ: 60, chance: 0.4, inds: CPG },
    { id: 'conv', region: 0, name: 'Convenience chain (90 stores)', hnl: 'Island convenience chain (90 stores)', cover: 0.14, tour: true, mult: 0.9, fee: 0, slot: 15000, minQ: 50, chance: 0.5, lag: 0.5, inds: ['snacks', 'beverage', 'beauty', 'electronics'] },
    { id: 'grocery', region: 0, name: 'Local grocery chain (35 stores)', cover: 0.18, mult: 0.88, fee: 0, slot: 40000, minQ: 55, chance: 0.45, lag: 0.5, inds: ['snacks', 'beverage', 'beauty'] },
    { id: 'dept', region: 0, name: 'Department store', cover: 0.08, mult: 0.85, fee: 0, slot: 20000, minQ: 60, chance: 0.45, lag: 1, inds: ['apparel', 'beauty', 'electronics'] },
    { id: 'stateChain', region: 1, name: 'Statewide grocery & drug chain', cover: 0.3, mult: 0.86, fee: 0, slot: 120000, minQ: 58, chance: 0.4, lag: 0.5, inds: ['snacks', 'beverage', 'beauty'] },
    { id: 'distributor', region: 1, name: 'Regional distributor (direct store delivery)', cover: 0.25, mult: 0.78, fee: 0, slot: 25000, minQ: 50, chance: 0.55, inds: ['snacks', 'beverage'] },
    { id: 'regionalRetail', region: 1, name: 'Regional retail chain', cover: 0.2, mult: 0.85, fee: 0, slot: 60000, minQ: 58, chance: 0.45, lag: 0.5, inds: ['apparel', 'electronics', 'beauty'] },
    { id: 'amazon', region: 2, name: 'Amazon & online marketplaces', cover: 0.15, mult: 0.85, varAdd: 0.08, fee: 3000, slot: 10000, minQ: 50, chance: 0.9, inds: CPG, note: 'Marketplace and fulfillment fees eat into margin.' },
    { id: 'natural', region: 2, name: 'National natural-foods distributor', cover: 0.12, mult: 0.8, fee: 0, slot: 150000, minQ: 60, chance: 0.45, lag: 0.5, inds: ['snacks', 'beverage', 'beauty'] },
    { id: 'drugNat', region: 2, name: 'National drugstore chains', cover: 0.25, mult: 0.84, fee: 0, slot: 300000, minQ: 60, chance: 0.4, lag: 1, inds: ['beauty', 'snacks', 'beverage'] },
    { id: 'specialty', region: 2, name: 'National specialty retailers', cover: 0.15, mult: 0.9, fee: 0, slot: 100000, minQ: 68, chance: 0.4, lag: 0.5, inds: ['beauty', 'apparel', 'electronics'] },
    { id: 'bigbox', region: 2, name: 'National big-box retailer (4,000 stores)', cover: 0.35, mult: 0.82, fee: 0, slot: 500000, minQ: 62, chance: 0.35, lag: 1, inds: CPG, note: 'Huge volume, thin margins, net-60 terms. Can you supply it?' },
    { id: 'asia', region: 3, name: 'Japan & Asia-Pacific distributor', cover: 0.08, mult: 0.75, fee: 0, slot: 200000, minQ: 65, chance: 0.4, lag: 1, inds: CPG },
    { id: 'dutyfree', region: 3, name: 'Duty-free & travel retail', cover: 0.05, mult: 1.0, fee: 4000, slot: 80000, minQ: 65, chance: 0.4, lag: 1, inds: CPG }
  ];

  // ---------- Your own retail ----------
  // cover = people a location serves; months = limited run (pop-ups); retail price ≈ 2× your wholesale list price.
  const STOREFRONTS = [
    { id: 'popup', name: 'Pop-up shop (3-month run)', capex: 8000, monthly: 3500, cover: 30000, months: 3, aw: 0.01, blurb: 'Test a neighborhood or a busy season cheaply.' },
    { id: 'kiosk', name: 'Mall kiosk', capex: 30000, monthly: 7000, cover: 50000, blurb: 'Low-cost permanent spot in a busy mall.' },
    { id: 'store', name: 'Street storefront', capex: 180000, monthly: 16000, cover: 120000, blurb: 'Your own shop: full retail price, your own staff and lease.' },
    { id: 'flagship', name: 'Flagship store', capex: 900000, monthly: 48000, cover: 350000, aw: 0.03, blurb: 'A destination store that builds the brand as well as selling.' }
  ];
  const WEBSTORE = { setup: 8000, monthly: 600, mult: 1.9, varAdd: 0.45 };

  // ---------- Supply partnerships with local farms & producers ----------
  // A partner sells you at a stable premium, almost never misses, caps how much it can supply, and lets you
  // claim "locally grown" (quality + home-market demand).
  const FARM_INPUTS = {
    _all: ['produce', 'dairy'],
    honolulu: ['macnut', 'coffee', 'produce', 'fish', 'dairy', 'glycerin'],
    losangeles: ['produce', 'dairy'], sanfrancisco: ['produce', 'dairy', 'coffee'], seattle: ['produce', 'potato', 'dairy'],
    austin: ['beef', 'produce'], houston: ['beef', 'chicken', 'rice'], midland: ['beef'], okc: ['beef', 'flour'], denver: ['beef', 'potato'],
    phoenix: ['produce'], chicago: ['flour', 'potato', 'dairy'], detroit: ['potato', 'dairy'], pittsburgh: ['dairy'],
    atlanta: ['chicken', 'produce'], nashville: ['chicken', 'beef'], miami: ['produce', 'sugar'], boston: ['dairy', 'fish'], newyork: ['dairy', 'produce']
  };
  const FARM_NAMES = { macnut: 'Big Island macadamia orchard', coffee: 'Kona coffee farm', produce: 'family vegetable farm', fish: 'longline fishing co-op', dairy: 'family dairy', potato: 'potato grower', beef: 'cattle ranch', chicken: 'poultry farm', rice: 'rice farm', flour: 'wheat farm & mill', sugar: 'cane sugar farm', glycerin: 'kukui & coconut oil grower' };

  // ---------- Product development ----------
  // Ingredient grades: pick cheap or elevated for each input. mult = price paid vs. standard; q = quality points
  // contributed (weighted by how much of a product's cost that input is; packaging counts half).
  const TIERS = { budget: { name: 'Budget', mult: 0.8, q: -12 }, standard: { name: 'Standard', mult: 1, q: 0 }, elevated: { name: 'Elevated', mult: 1.45, q: 12 } };
  const TIER_NAMES = {
    actives: ['Generic zinc oxide', 'Cosmetic-grade zinc oxide', 'Non-nano coated zinc + botanical extracts'],
    glycerin: ['Industrial glycerin & mineral oil', 'USP glycerin & carrier oils', 'Organic kukui, coconut & jojoba oils'],
    jars: ['Thin plastic tubes', 'Standard tubes & pumps', 'Recyclable aluminum & glass'],
    potato: ['Commodity potatoes', 'Chipping potatoes', 'Heirloom, hand-sorted potatoes'],
    vegoil: ['Palm-oil blend', 'Canola oil', 'Avocado oil'],
    sugar: ['Beet-sugar blend', 'Cane sugar', 'Organic raw cane sugar'],
    cocoa: ['Bulk West African cocoa', 'Fair-trade cocoa', 'Single-origin fine-flavor cocoa'],
    macnut: ['Pieces & seconds', 'Standard kernels', 'Whole style-1 kernels'],
    coffee: ['Robusta blend', 'Specialty arabica', '100% Kona micro-lots'],
    flour: ['Bleached all-purpose', 'Unbleached flour', 'Organic stone-ground'],
    dairy: ['Conventional milk', 'Local fresh milk', 'Organic grass-fed milk'],
    beef: ['80/20 commodity beef', 'USDA Choice', 'Grass-fed local beef'],
    chicken: ['Commodity chicken', 'Antibiotic-free chicken', 'Pasture-raised chicken'],
    fish: ['Frozen imported fish', 'Fresh ahi', 'Day-boat, sashimi-grade ahi'],
    produce: ['Mainland bulk produce', 'Fresh standard produce', 'Local organic produce'],
    rice: ['Broken / bulk rice', 'Calrose rice', 'Premium short-grain rice'],
    cotton: ['Basic cotton', 'Combed cotton', 'Organic Pima & rayon prints'],
    poly: ['Basic polyester', 'Performance knit', 'Recycled premium knit'],
    trims: ['Plastic buttons & generic labels', 'Standard trims', 'Coconut-shell buttons & woven labels'],
    soles: ['Basic EVA soles', 'Standard rubber soles', 'Premium foam & leather uppers'],
    flavor: ['Artificial flavors', 'Natural flavors', 'Cold-pressed fruit & botanicals'],
    co2: ['Industrial-grade CO2', 'Beverage-grade CO2', 'Beverage-grade CO2'],
    alcan: ['Thin-wall cans', 'Standard cans', 'Sleek cans with premium print'],
    glass: ['Thin glass', 'Standard bottles', 'Heavy premium glass'],
    film: ['Basic film', 'Standard barrier film', 'Compostable premium film'],
    carton: ['Plain cartons', 'Printed cartons', 'Recycled display-ready cartons'],
    semis: ['Budget chipsets', 'Mainstream chipsets', 'Flagship chipsets'],
    display: ['Basic LCD', 'IPS panels', 'OLED panels'],
    cells: ['Second-tier cells', 'Tier-1 cells', 'Top-tier high-density cells'],
    pcb: ['Budget boards & plastics', 'Standard boards', 'Premium boards & aluminum housings'],
    modules: ['Tier-3 panels', 'Tier-1 panels', 'High-efficiency premium panels'],
    inverter: ['Budget inverters', 'Mainstream inverters', 'Premium microinverters'],
    racking: ['Basic racking', 'Standard racking', 'Hurricane-rated racking'],
    steel: ['Commodity steel', 'Automotive steel', 'High-strength steel'],
    aluminum: ['Recycled-grade aluminum', 'Standard aluminum', 'Aerospace-grade aluminum'],
    copper: ['Standard copper', 'Standard copper', 'High-purity copper']
  };
  // Improvement projects per product (id-specific) or per industry (applies to every product). cost in $, months to
  // complete, q = quality points gained, mat = multiplier on materials per unit, demand = permanent demand lift.
  const UPGRADES = {
    sunscreen: [
      { id: 'reefsafe', name: 'Reformulate with non-nano zinc oxide', desc: 'Reef-safe and compliant with Hawaii\'s oxybenzone/octinoxate ban. Customers in Hawaii look for it.', cost: 40000, months: 2, q: 6, mat: 1.08, demandHome: 1.08 },
      { id: 'spf50', name: 'SPF 50 + 80-minute water-resistance testing', desc: 'FDA-protocol lab testing so you can put it on the label.', cost: 65000, months: 3, q: 7 },
      { id: 'sheer', name: 'Sheer, non-whitening texture', desc: 'Dispersion R&D so mineral sunscreen stops leaving a white cast. The biggest complaint about the category.', cost: 90000, months: 4, q: 9, rd: 60 },
      { id: 'derm', name: 'Dermatologist clinical study', desc: 'Sensitive-skin and pediatric testing with a published result.', cost: 150000, months: 5, q: 5, demand: 1.05 },
      { id: 'tube', name: 'Recyclable aluminum tube', desc: 'Plastic-free packaging. Costs more per unit.', cost: 35000, months: 2, q: 3, mat: 1.06 }
    ],
    _beauty: [
      { id: 'clinical', name: 'Clinical efficacy testing', desc: 'Third-party testing of your claims.', cost: 80000, months: 3, q: 6 },
      { id: 'clean', name: 'Clean reformulation', desc: 'Remove controversial ingredients; costs more to make.', cost: 50000, months: 3, q: 5, mat: 1.1 },
      { id: 'qa', name: 'In-house QA lab & batch testing', desc: 'Catch problems before they ship.', cost: 40000, months: 2, q: 4 }
    ],
    _snacks: [
      { id: 'nongmo', name: 'Non-GMO & organic certification', desc: 'Certified ingredients cost more but shoppers pay for them.', cost: 45000, months: 4, q: 6, mat: 1.12 },
      { id: 'process', name: 'Process upgrade (kettle, roasting, tempering)', desc: 'Better texture and flavor consistency.', cost: 70000, months: 3, q: 7, rd: 40 },
      { id: 'shelf', name: 'Shelf-life & packaging redesign', desc: 'Nitrogen flush and better film: fresher product, fewer returns.', cost: 35000, months: 2, q: 4, mat: 1.03 },
      { id: 'sqf', name: 'SQF food-safety certification', desc: 'Many grocery buyers require it.', cost: 30000, months: 3, q: 4 }
    ],
    _beverage: [
      { id: 'flavor', name: 'Flavor reformulation with a flavor house', desc: 'Consumer-tested recipes.', cost: 60000, months: 3, q: 7 },
      { id: 'lowsugar', name: 'Low-sugar recipe', desc: 'Cuts sugar with natural sweeteners. Growing demand.', cost: 50000, months: 3, q: 5, demand: 1.05 },
      { id: 'cane', name: 'Real cane sugar & natural flavors', desc: 'Premium ingredients cost more.', cost: 25000, months: 2, q: 5, mat: 1.1 },
      { id: 'sqf', name: 'SQF food-safety certification', desc: 'Many grocery buyers require it.', cost: 30000, months: 3, q: 4 }
    ],
    _apparel: [
      { id: 'fabric', name: 'Higher-grade fabric', desc: 'Better hand-feel and durability; costs more.', cost: 30000, months: 2, q: 7, mat: 1.15 },
      { id: 'fit', name: 'Fit & pattern re-engineering', desc: 'Fewer returns, better reviews.', cost: 55000, months: 3, q: 6 },
      { id: 'local', name: 'Collaboration with a local artist', desc: 'Limited prints that sell out.', cost: 25000, months: 2, q: 4, demandHome: 1.08 }
    ],
    _electronics: [
      { id: 'battery', name: 'Battery life and power redesign', desc: 'Longer runtime, better reviews.', cost: 150000, months: 4, q: 7, rd: 80 },
      { id: 'audio', name: 'Industrial design refresh', desc: 'Better look and feel.', cost: 120000, months: 4, q: 6 },
      { id: 'qa', name: 'Reliability testing & QA', desc: 'Lower return rates.', cost: 80000, months: 3, q: 5 }
    ],
    _restaurants: [
      { id: 'chef', name: 'Hire a name chef to redo the menu', desc: 'Better food, better reviews.', cost: 60000, months: 2, q: 8 },
      { id: 'local', name: 'Locally sourced menu', desc: 'Costs more per plate; diners love it.', cost: 20000, months: 2, q: 5, mat: 1.1, demandHome: 1.05 },
      { id: 'service', name: 'Service training program', desc: 'Faster lines, friendlier staff.', cost: 30000, months: 2, q: 4 }
    ],
    _saas: [
      { id: 'ux', name: 'UX redesign', desc: 'Easier onboarding, lower churn.', cost: 150000, months: 4, q: 7 },
      { id: 'ai', name: 'AI assistant features', desc: 'What every buyer is asking for.', cost: 250000, months: 5, q: 8, rd: 100 },
      { id: 'soc2', name: 'Security & uptime program', desc: 'SOC 2, redundancy, on-call.', cost: 120000, months: 4, q: 5 }
    ],
    _fintech: [
      { id: 'ux', name: 'App redesign', desc: 'Faster, clearer, fewer support tickets.', cost: 150000, months: 4, q: 7 },
      { id: 'fraud', name: 'Fraud & risk models', desc: 'Lower losses and fewer frozen accounts.', cost: 200000, months: 5, q: 6 }
    ],
    _solar: [
      { id: 'panels', name: 'Premium high-efficiency panels', desc: 'Better yield per roof; costs more.', cost: 20000, months: 1, q: 6, mat: 1.1 },
      { id: 'design', name: 'Remote design & permitting software', desc: 'Faster, cleaner installs.', cost: 120000, months: 4, q: 6 },
      { id: 'warranty', name: '25-year workmanship warranty', desc: 'Customers trust you more.', cost: 60000, months: 2, q: 4, demand: 1.04 }
    ],
    _ev: [
      { id: 'range', name: 'Battery & motor efficiency', desc: 'More range per kWh.', cost: 400000, months: 6, q: 8, rd: 150 },
      { id: 'design', name: 'Design & fit-and-finish', desc: 'Better reviews and resale.', cost: 250000, months: 4, q: 6 }
    ],
    _airline: [
      { id: 'ontime', name: 'On-time performance program', desc: 'Spare parts, crew buffers, better ops control.', cost: 300000, months: 3, q: 7 },
      { id: 'cabin', name: 'Cabin refresh & local hospitality', desc: 'New seats, Hawaiian-style service.', cost: 500000, months: 4, q: 6, demandHome: 1.05 }
    ],
    _logistics: [
      { id: 'telematics', name: 'Telematics & route optimization', desc: 'Faster, more reliable delivery.', cost: 200000, months: 4, q: 7 },
      { id: 'safety', name: 'Driver safety program', desc: 'Fewer accidents, better shipper ratings.', cost: 80000, months: 3, q: 5 }
    ],
    _datacenter: [
      { id: 'network', name: 'InfiniBand networking upgrade', desc: 'Faster training jobs for customers.', cost: 500000, months: 3, q: 7 },
      { id: 'sla', name: '99.99% uptime SLA', desc: 'Redundant power and cooling.', cost: 300000, months: 4, q: 6 }
    ],
    _power: [
      { id: 'trackers', name: 'Single-axis trackers & bifacial panels', desc: 'More output from every site.', cost: 250000, months: 4, q: 8 },
      { id: 'om', name: 'Predictive maintenance', desc: 'Less downtime.', cost: 120000, months: 3, q: 5 }
    ],
    _oilgas: [
      { id: 'completion', name: 'Longer laterals & completion design', desc: 'Higher initial production from new wells.', cost: 400000, months: 4, q: 8 },
      { id: 'artificial', name: 'Artificial lift optimization', desc: 'Slows decline on existing wells.', cost: 200000, months: 3, q: 5 }
    ]
  };

  G.GC_DATA = { MKT_CHANNELS, MKT_PRESETS, ACCOUNTS, STOREFRONTS, WEBSTORE, FARM_INPUTS, FARM_NAMES, TIERS, TIER_NAMES, UPGRADES, CITIES, COMMODITIES, SUPPLIER_TYPES, INDUSTRIES, BACKGROUNDS, ROUNDS, MONTHS, COMPANY_WORDS };
})(typeof window !== 'undefined' ? window : globalThis);
