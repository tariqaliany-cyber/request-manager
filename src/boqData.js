// Official B.O.Q (Maintenance / Signages) item list — extracted from
// "Price List Agreement - Maintenance Signages.pdf". No rates/prices are
// stored here; this feeds the Delivery Note BOQ item picker only.
//
// Item shape: { itemNo, category, description, unit }
// Additional BOQ files (e.g. Project Signages) can be added later as a
// separate exported array following the same shape.

export const BOQ_CATEGORIES = [
  'Building Signages',
  'Electricals',
  'Painting',
  'Acrylic / Lexan / Glass',
  'Renovation Signages',
  'Repair',
  'Cladding Work',
  'Removal of Signages',
  'Sticker',
  'Installation',
  'Transportation and Outstation',
  'Crane Charges',
];

export const BOQ_ITEMS = [
  // 1. Building Signages
  { itemNo: '1',  category: 'Building Signages', description: "Maintenance of Elevation Signage Full Store (FSDT) including Unipole & DT signage's", unit: 'AU' },
  { itemNo: '2',  category: 'Building Signages', description: "Maintenance of Elevation Signage Full Store (Front Store & mall) including signage's", unit: 'AU' },
  { itemNo: '3',  category: 'Building Signages', description: 'Maintenance of External Unipole Sign excluding crane charges', unit: 'AU' },
  { itemNo: '4',  category: 'Building Signages', description: 'Maintenance of External Flex Signage Full Store ( Free Stand)', unit: 'AU' },
  { itemNo: '5',  category: 'Building Signages', description: 'Maintenance Light Box', unit: 'Pc' },
  { itemNo: '6',  category: 'Building Signages', description: 'Maintenance Mupi double sided', unit: 'Pc' },
  { itemNo: '7',  category: 'Building Signages', description: 'Maintenance of Menu Board Herfy Style DT4 & DT3', unit: 'Pc' },
  { itemNo: '8',  category: 'Building Signages', description: 'Maintenance of European Style Menu Board Complete Set', unit: 'Pc' },
  { itemNo: '9',  category: 'Building Signages', description: 'Maintenance of Directional Sign', unit: 'Pc' },
  { itemNo: '10', category: 'Building Signages', description: 'Maintenance of Herfy smart gate drive Thru complete set', unit: 'Set' },

  // 2. Electricals
  { itemNo: '11', category: 'Electricals', description: 'Replacement of Transformer Korea - 60w', unit: 'Pc' },
  { itemNo: '12', category: 'Electricals', description: 'Replacement of Transformer Korea - 100w', unit: 'Pc' },
  { itemNo: '13', category: 'Electricals', description: 'Replacement of Transformer Korea - 150w', unit: 'Pc' },
  { itemNo: '14', category: 'Electricals', description: 'Replacement of Transformer Korea - 200w', unit: 'Pc' },
  { itemNo: '15', category: 'Electricals', description: 'Replacement of Transformer Korea - 300w', unit: 'Pc' },
  { itemNo: '16', category: 'Electricals', description: 'Replacement of damaged led (Modules)', unit: 'Pc' },
  { itemNo: '17', category: 'Electricals', description: 'Replacement of damaged Electrical Cable 220V - 2 core', unit: 'm' },
  { itemNo: '18', category: 'Electricals', description: 'Replacement of Complete Electricals with LED Tubes (Flex Face)', unit: 'm²' },
  { itemNo: '19', category: 'Electricals', description: 'Replacement of Old/damaged Spot Light with New LED Spot light Billboard', unit: 'Pc' },
  { itemNo: '20', category: 'Electricals', description: 'Electrical Replacement of Mupi (Cable, Transformer Led tubes & Led)', unit: 'AU' },
  { itemNo: '21', category: 'Electricals', description: 'Electrical Replacement of Light Box (Cable, Transformer Led tubes & Led)', unit: 'AU' },
  { itemNo: '22', category: 'Electricals', description: 'Electrical Replacement of Menu Board DT3 & DT4 (Cable, Transformer Led tubes & Led)', unit: 'AU' },
  { itemNo: '23', category: 'Electricals', description: 'Electrical Replacement of Menu Board European Style (Cable, Transformer Led tubes & Led)', unit: 'Set' },
  { itemNo: '24', category: 'Electricals', description: 'Electrical Replacement of Directional Sign (Old Style) (Cable, Transformer Led tubes & Led)', unit: 'AU' },
  { itemNo: '25', category: 'Electricals', description: 'Electrical Replacement of Directional Sign (Cladding Type)(Cable, Transformer Led tubes & Led)', unit: 'AU' },
  { itemNo: '26', category: 'Electricals', description: 'Complete electrical replacement including the flex face elevation / Unipole', unit: 'm²' },

  // 3. Painting
  { itemNo: '27', category: 'Painting', description: 'Painting of Flex Face Side Cover', unit: 'AU' },
  { itemNo: '28', category: 'Painting', description: 'Painting of Flex Angle', unit: 'AU' },
  { itemNo: '29', category: 'Painting', description: 'Painting of Unipole (POST.LOGO,HERFY,& DRIVE THRU CLADDING BOX', unit: 'AU' },
  { itemNo: '30', category: 'Painting', description: 'Painting menu Board Herfy style DT3/DT4', unit: 'AU' },
  { itemNo: '31', category: 'Painting', description: 'Painting Light Box', unit: 'Pc' },
  { itemNo: '32', category: 'Painting', description: 'Painting of MUPI', unit: 'Pc' },
  { itemNo: '33', category: 'Painting', description: 'Painting of Directional Sign old', unit: 'Pc' },
  { itemNo: '34', category: 'Painting', description: 'Painting menu Board European style', unit: 'Set' },
  { itemNo: '35', category: 'Painting', description: 'Painting European style Height Barrier', unit: 'Pc' },

  // 4. Acrylic / Lexan / Glass
  { itemNo: '36', category: 'Acrylic / Lexan / Glass', description: 'Replacement of Flat Face (2D) Acrylic Logos and Text', unit: 'm²' },
  { itemNo: '37', category: 'Acrylic / Lexan / Glass', description: 'Replacement of flat Acrylic Logos and Text', unit: 'm²' },
  { itemNo: '38', category: 'Acrylic / Lexan / Glass', description: 'Acrylic Siding for Herfy Text Arabic & English', unit: 'm' },
  { itemNo: '39', category: 'Acrylic / Lexan / Glass', description: 'Replacement of Acrylic in MUPI/LIGHTBOX 3MM', unit: 'Pc' },
  { itemNo: '40', category: 'Acrylic / Lexan / Glass', description: 'Replacement of Lexan in MUPI/LIGHTBOX 6MM', unit: 'Pc' },
  { itemNo: '41', category: 'Acrylic / Lexan / Glass', description: 'Replacement of Acrylic European Style Menu Board & DT4 2MM', unit: 'Pc' },
  { itemNo: '42', category: 'Acrylic / Lexan / Glass', description: 'Replacement of Lexan European Style Menu Board & DT4 1MM', unit: 'Pc' },
  { itemNo: '43', category: 'Acrylic / Lexan / Glass', description: 'Replacement of damaged Acrylic in Directional Sign(Old)', unit: 'Pc' },
  { itemNo: '44', category: 'Acrylic / Lexan / Glass', description: 'Change of Directional Sign Acrylic Top portion Logo with Oracle red vinyl 016', unit: 'Pc' },
  { itemNo: '45', category: 'Acrylic / Lexan / Glass', description: 'Change of Directional Sign Acrylic bottom portion text', unit: 'Pc' },
  { itemNo: '46', category: 'Acrylic / Lexan / Glass', description: 'Menu Board Glass replacement 6MM DT3 (4PCS)', unit: 'Set' },
  { itemNo: '47', category: 'Acrylic / Lexan / Glass', description: 'Menu Board Lexan Replacement DT4/DT3 style', unit: 'Pc' },
  { itemNo: '48', category: 'Acrylic / Lexan / Glass', description: 'Change Glass Rubber beading(Dust proof & water proofing)', unit: 'm' },
  { itemNo: '49', category: 'Acrylic / Lexan / Glass', description: 'Change of Acrylic for L shape/C shape smart gate', unit: 'Pc' },

  // 5. Renovation Signages
  { itemNo: '50', category: 'Renovation Signages', description: 'Complete LED change with Transformer & cables for logo & text', unit: 'm²' },
  { itemNo: '51', category: 'Renovation Signages', description: 'Maintenance,Electrical change&Painting Lightbox', unit: 'Pc' },
  { itemNo: '52', category: 'Renovation Signages', description: 'Maintenance,Electrical change&Painting Mupi', unit: 'Pc' },
  { itemNo: '53', category: 'Renovation Signages', description: 'Maintenance,Electrical change, Acrylic change & Painting of Directional sign', unit: 'Pc' },
  { itemNo: '54', category: 'Renovation Signages', description: 'Maintenance,Electrical change&Painting of Menu Board DT3/DT4', unit: 'Pc' },
  { itemNo: '55', category: 'Renovation Signages', description: 'Maintenance & Electrical change of European style.', unit: 'Set' },
  { itemNo: '56', category: 'Renovation Signages', description: 'Flat Logo Complete Change', unit: 'm²' },

  // 6. Repair
  { itemNo: '57', category: 'Repair', description: 'Replacement of Hinges for Box light/Menu board', unit: 'Pc' },
  { itemNo: '58', category: 'Repair', description: 'Various style Herfy menu board door alignment', unit: 'Pc' },
  { itemNo: '59', category: 'Repair', description: 'Menu Board European Style Door Maintenance and Refixing', unit: 'Pc' },
  { itemNo: '60', category: 'Repair', description: 'Menu Board Herfy Style Door Maintenance and Refixing', unit: 'Pc' },
  { itemNo: '61', category: 'Repair', description: 'Fixing Stainless steel Siding of Directional Sign Cladding Type', unit: 'AU' },
  { itemNo: '62', category: 'Repair', description: 'Alingment of Unipole Herfy Logo Head', unit: 'AU' },
  { itemNo: '63', category: 'Repair', description: 'Alingment of Unipole Drive Thru and Herfy box', unit: 'AU' },
  { itemNo: '64', category: 'Repair', description: 'Replacement of backsheet', unit: 'm²' },
  { itemNo: '65', category: 'Repair', description: 'Replacement of damaged Forex base with dust protection', unit: 'm²' },
  { itemNo: '66', category: 'Repair', description: 'Change of Flex face', unit: 'AU' },
  { itemNo: '67', category: 'Repair', description: 'Lock change Mupi, Light Box, European Style Menu Board, Herfy Style Menu Board', unit: 'Pc' },
  { itemNo: '68', category: 'Repair', description: 'Waterproofing for the Drive Thru Smartgate L shape/C shape', unit: 'Pc' },

  // 7. Cladding Work
  { itemNo: '69', category: 'Cladding Work', description: 'Fire Rated Cladding (Supply and Install) including steel structure', unit: 'm²' },
  { itemNo: '70', category: 'Cladding Work', description: 'Installation of ACP cladding supplied by Herfy including steel structure', unit: 'm²' },
  { itemNo: '71', category: 'Cladding Work', description: 'Supply & Installation of Herfy brown FR cladding including structure', unit: 'm²' },
  { itemNo: '72', category: 'Cladding Work', description: 'Installation of ACP cladding Herfy brown FR cladding including structure', unit: 'm²' },
  { itemNo: '73', category: 'Cladding Work', description: 'Removal of ACP cladding & structure', unit: 'm²' },
  { itemNo: '74', category: 'Cladding Work', description: 'Supply & Installation of Aluminium Louvers cladding 40x20x 2mm', unit: 'm²' },

  // 8. Removal of Signages
  { itemNo: '75', category: 'Removal of Signages', description: 'Unipole', unit: 'Pc' },
  { itemNo: '76', category: 'Removal of Signages', description: 'HERFY Logo', unit: 'Pc' },
  { itemNo: '77', category: 'Removal of Signages', description: 'Herfy Text Arabic /English text', unit: 'Pc' },
  { itemNo: '78', category: 'Removal of Signages', description: 'complete store signage removal (free stand) excluding Unipole)', unit: 'Pc' },
  { itemNo: '79', category: 'Removal of Signages', description: 'Removal of Light Box', unit: 'Pc' },
  { itemNo: '80', category: 'Removal of Signages', description: 'Removal & relocation of Light Box', unit: 'Pc' },
  { itemNo: '81', category: 'Removal of Signages', description: 'Removal of Directional Sign', unit: 'Pc' },
  { itemNo: '82', category: 'Removal of Signages', description: 'Removal & relocation of Directional Sign', unit: 'Pc' },
  { itemNo: '83', category: 'Removal of Signages', description: 'Removal & relocation of Mupi', unit: 'Pc' },
  { itemNo: '84', category: 'Removal of Signages', description: 'Removal Charges of Menu Board DT', unit: 'Pc' },
  { itemNo: '85', category: 'Removal of Signages', description: 'Removal & relocation of Menu board DT4/DT3', unit: 'Pc' },
  { itemNo: '86', category: 'Removal of Signages', description: 'Removal of Flex face sign board /sqm', unit: 'Pc' },
  { itemNo: '87', category: 'Removal of Signages', description: 'complete store signage removal (Front store/Mall Store)', unit: 'AU' },
  { itemNo: '88', category: 'Removal of Signages', description: 'Complete Removal of Flex Face Signage', unit: 'm²' },
  { itemNo: '89', category: 'Removal of Signages', description: 'Removal Charges for Banners', unit: 'm²' },

  // 9. Sticker
  { itemNo: '90',  category: 'Sticker', description: 'Supply and Installation of Sticker for Logos', unit: 'm²' },
  { itemNo: '91',  category: 'Sticker', description: 'Supply and Installation of Frosted Vinyl (3M) on Glass with Completed Removal & Cleaning', unit: 'm²' },
  { itemNo: '92',  category: 'Sticker', description: 'Print Floor Sticker for Promotions with heavy duty lamination', unit: 'm²' },
  { itemNo: '93',  category: 'Sticker', description: 'Wall Branding removal and Install new', unit: 'm²' },
  { itemNo: '94',  category: 'Sticker', description: 'Supply of Roll Up Stand(As Per Herfy Approved)', unit: 'Pc' },
  { itemNo: '95',  category: 'Sticker', description: 'Print Roll Up Stand Standard(As Per Herfy Approved)', unit: 'Pc' },
  { itemNo: '96',  category: 'Sticker', description: 'Promotions Banners Print & Install (Outer region)', unit: 'm²' },
  { itemNo: '97',  category: 'Sticker', description: 'Promotions Banners Print & Install ( Riyadh region)', unit: 'm²' },
  { itemNo: '98',  category: 'Sticker', description: 'Printing banner Only ( no installation)', unit: 'm²' },
  { itemNo: '99',  category: 'Sticker', description: 'Steel Frame for Banner', unit: 'm²' },
  { itemNo: '100', category: 'Sticker', description: 'Installation Charges for Promitional Banners', unit: 'm²' },
  { itemNo: '101', category: 'Sticker', description: 'Print & Supply Stickers with lamination', unit: 'm²' },
  { itemNo: '102', category: 'Sticker', description: 'Print & Supply backlit film', unit: 'm²' },

  // 10. Installation
  { itemNo: '103', category: 'Installation', description: 'Installation Directional Signage ( Cladding Type)/on existing Foundation', unit: 'Pc' },
  { itemNo: '104', category: 'Installation', description: 'Installation Directional Signage (Old Type)/on existing Foundation', unit: 'Pc' },
  { itemNo: '105', category: 'Installation', description: 'Installation Mupi on existing Foundation', unit: 'Pc' },
  { itemNo: '106', category: 'Installation', description: 'Installation Menu Board Herfy Style on existing Foundation', unit: 'Pc' },
  { itemNo: '107', category: 'Installation', description: 'Installation Menu Board European Style on existing Foundation', unit: 'Set' },
  { itemNo: '108', category: 'Installation', description: 'Installation of Flex Board New Side Cover with paint', unit: 'AU' },
  { itemNo: '109', category: 'Installation', description: 'Disability Sign', unit: 'AU' },
  { itemNo: '110', category: 'Installation', description: 'Disabled parking sign with plotter cut reflective sticker without Stand', unit: 'AU' },

  // 11. Transportation and Outstation
  { itemNo: '111', category: 'Transportation and Outstation', description: 'OUT OF RIYADH - 200KM', unit: 'AU' },
  { itemNo: '112', category: 'Transportation and Outstation', description: 'EASTERN REGION', unit: 'AU' },
  { itemNo: '113', category: 'Transportation and Outstation', description: 'WESTERN REGION', unit: 'AU' },
  { itemNo: '114', category: 'Transportation and Outstation', description: 'SOUTHERN REGION', unit: 'AU' },
  { itemNo: '115', category: 'Transportation and Outstation', description: 'NORTHERN REGION', unit: 'AU' },
  { itemNo: '116', category: 'Transportation and Outstation', description: 'TRAILER CHARGES FOR UNIPOLE ONLY (Central Eastern Region)', unit: 'AU' },
  { itemNo: '117', category: 'Transportation and Outstation', description: 'TRAILER CHARGES FOR UNIPOLE ONLY( west, south and North region)', unit: 'AU' },

  // 12. Crane Charges
  { itemNo: '118', category: 'Crane Charges', description: 'OUT OF RIYADH - 200KM', unit: 'AU' },
  { itemNo: '119', category: 'Crane Charges', description: 'EASTERN REGION', unit: 'AU' },
  { itemNo: '120', category: 'Crane Charges', description: 'WESTERN REGION', unit: 'AU' },
  { itemNo: '121', category: 'Crane Charges', description: 'SOUTHERN REGION', unit: 'AU' },
  { itemNo: '122', category: 'Crane Charges', description: 'NORTHERN REGION', unit: 'AU' },
];
