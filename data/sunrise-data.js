/*
 * Keep Sunrise Open: site data.
 * Compiled 2026-11-07 from the "Sunrise Scenario Data" set (district documents S1-S10).
 * Values labeled as calculations elsewhere on the site are NOT district figures.
 * Verify against sources before publishing. Edit numbers here and every chart/table updates.
 */
window.SITE_CONFIG = {
  campaignName: "Keep Sunrise Open",
  boardVoteDate: "March 8, 2027",
  // Contact email for the parent group. Leave "" to hide.
  contactEmail: "",
  lastUpdated: "November 8, 2026"
};

window.SUNRISE_DATA = {
  compiled: "2026-11-07",
  credit: "Underlying data compiled as a community service by Tony Meier & Team, Windermere Real Estate / NE.",

  schools: [
    { school: "Sunrise", built: 1985, modernized: null, permanent_classrooms: 19, portable_classrooms: 1, design_capacity_edac: 450, cfp_permanent_seats: 388, cfp_portable_seats: 41, cfp_total_seats: 429, site_acres: 11.0, enrolled_fte_oct2026: 245, sewer: "Public sewer", uga: "Inside UGA", corrective_2025_2029: 10688618, building_sqft: 47481, corrective_per_sqft: 225, director_district: 5 },
    { school: "Hollywood Hill", built: 1980, modernized: "2001", permanent_classrooms: 22, portable_classrooms: 2, design_capacity_edac: 540, cfp_permanent_seats: 408, cfp_portable_seats: 41, cfp_total_seats: 449, site_acres: 13.7, enrolled_fte_oct2026: 357, sewer: "Private sewer siphon to Woodinville Water District", uga: "Outside UGA", corrective_2025_2029: 17690044, building_sqft: 54215, corrective_per_sqft: 326, director_district: 5 },
    { school: "Cottage Lake", built: 1958, modernized: "1998, 2005", permanent_classrooms: 21, portable_classrooms: 0, design_capacity_edac: 473, cfp_permanent_seats: 367, cfp_portable_seats: 0, cfp_total_seats: 367, site_acres: 8.2, enrolled_fte_oct2026: 262, sewer: "Not sewered; sewage trucked", uga: "Outside UGA", corrective_2025_2029: 11322039, building_sqft: 54644, corrective_per_sqft: 207, director_district: 5 },
    { school: "Moorlands", built: 1963, modernized: "1994, 2002", permanent_classrooms: 25, portable_classrooms: 9, design_capacity_edac: 765, cfp_permanent_seats: 510, cfp_portable_seats: 184, cfp_total_seats: 694, site_acres: 6.9, enrolled_fte_oct2026: 460, sewer: "Not covered by sewer plan", uga: "n/a", corrective_2025_2029: 13981546, building_sqft: 56279, corrective_per_sqft: 248, director_district: 2 },
    { school: "East Ridge", built: null, modernized: null, permanent_classrooms: 20, portable_classrooms: 2, design_capacity_edac: 495, cfp_permanent_seats: 408, cfp_portable_seats: 0, cfp_total_seats: 408, site_acres: 16.4, enrolled_fte_oct2026: null, sewer: "Not sewered; sewage trucked", uga: "Outside UGA", corrective_2025_2029: 767001, building_sqft: 53220, corrective_per_sqft: 14, director_district: 5 },
    { school: "Wellington", built: null, modernized: null, permanent_classrooms: 22, portable_classrooms: 4, design_capacity_edac: 585, cfp_permanent_seats: 449, cfp_portable_seats: 61, cfp_total_seats: 510, site_acres: 15.0, enrolled_fte_oct2026: null, sewer: "Not sewered; sewage trucked", uga: "Inside UGA (unsewered area)", corrective_2025_2029: 7180342, building_sqft: 51167, corrective_per_sqft: 140, director_district: 5 }
  ],

  // Resident students (children living in each attendance area). 2023-2026 actual, 2027-2030 projected. Source S3.
  years: [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
  firstProjectedYear: 2027,
  residents: {
    "Sunrise":        [247, 227, 208, 197, 190, 189, 192, 206],
    "Arrowhead":      [280, 286, 263, 263, 233, 230, 225, 204],
    "Cottage Lake":   [307, 302, 310, 309, 301, 306, 313, 323],
    "East Ridge":     [478, 486, 450, 446, 406, 388, 396, 386],
    "Hollywood Hill": [261, 264, 275, 285, 265, 262, 260, 249],
    "Moorlands":      [536, 520, 492, 440, 446, 438, 440, 440],
    "Wellington":     [419, 374, 353, 338, 336, 336, 344, 359]
  },

  fixedCosts: {
    "Sunrise":        { total: 1319985, after5: 1253986, buildingOnlyAfter5: 287123 },
    "Cottage Lake":   { total: 1312164, after5: 1246556, buildingOnlyAfter5: 278640 },
    "Moorlands":      { total: 1451760, after5: 1379172, buildingOnlyAfter5: 295782 },
    "Hollywood Hill": { total: 1418987, after5: 1348038, buildingOnlyAfter5: 295201 }
  },
  sunriseFixedLines: [
    ["Utilities", 98118], ["Principal", 263858], ["Librarian", 135470], ["Counselor", 170445],
    ["Office Manager", 124017], ["Main Office Secretary", 65711], ["School Assistants", 79810],
    ["Nurse", 114231], ["Facility Manager", 107816], ["Custodian", 96301], ["Add'l Labor/Stipends", 64207]
  ],

  facilityCondition: {
    "Sunrise":        [5119967, 30220, 1441087, 2454208, 1643136],
    "Hollywood Hill": [7338179, 1817250, 0, 5532509, 3002106],
    "Cottage Lake":   [403298, 75922, 0, 5961279, 4881540],
    "Moorlands":      [2718437, 1680350, 695936, 875129, 8011694],
    "Wellington":     [532981, 473514, 0, 5973135, 200712],
    "East Ridge":     [0, 580235, 0, 186766, 0]
  },
  facilityYears: [2025, 2026, 2027, 2028, 2029],

  scenarios: [
    { id: 1, closes: ["Cottage Lake", "Sunrise", "Moorlands"], keepsSunrise: false,
      whereStudentsGo: "Cottage Lake to Wellington, East Ridge, Hollywood Hill; Sunrise to Hollywood Hill",
      netA: 3407931, netB: 3261170, fixedBefore5: 4083909, addedStaffA: 471783, addedStaffB: 618543,
      residentsMoved: 930, eastSideChanging: 494, districtwideChanging: 1178, walkersToBus: 210,
      routesNow: 32, routesAfter: 38, over45Now: 1, over45After: 1, longestNow: 50, longestAfter: 50,
      rationale: "Zero east side schools at or below 400 students." },
    { id: 2, closes: ["Sunrise", "Moorlands"], keepsSunrise: false,
      whereStudentsGo: "Sunrise to Cottage Lake (SR0 151, SR2 8) and Hollywood Hill (SR1 30); a Cottage Lake area to Hollywood Hill",
      netA: 2220830, netB: 2168524, fixedBefore5: 2771745, addedStaffA: 412328, addedStaffB: 464633,
      residentsMoved: 625, eastSideChanging: 217, districtwideChanging: 901, walkersToBus: 158,
      routesNow: 16, routesAfter: 16, over45Now: 0, over45After: 1, longestNow: 44, longestAfter: 51,
      rationale: "Sunrise is “currently the lowest enrolled school”; Scenario 2 “only partially solves the problem.”" },
    { id: 3, closes: ["Hollywood Hill", "Moorlands"], keepsSunrise: true,
      whereStudentsGo: "Hollywood Hill to Sunrise (HH0 70), Cottage Lake (HH1 47, HH3 21), Wellington",
      netA: 2340150, netB: 2182062, fixedBefore5: 2870747, addedStaffA: 387059, addedStaffB: 545147,
      residentsMoved: 697, eastSideChanging: 261, districtwideChanging: 945, walkersToBus: 14,
      routesNow: 26, routesAfter: 28, over45Now: 0, over45After: 2, longestNow: 44, longestAfter: 49,
      rationale: "Sunrise “would still be the lowest enrolled school in the district.”" }
  ],

  inputs: {
    costPerBusRider: 1605,          // S8, OSPI; verify current year
    stateFundingPerStudent: 12000,  // ASSUMPTION for testing; replace with a sourced figure
    shareMovedStudentsLeaving: 0,   // ASSUMPTION for testing (percent)
    scenario2SewageHauling: 0       // Not published; request from district
  },

  timeline: [
    { date: "Oct 26, 2026", title: "District presents three scenarios", body: "Two of the three scenarios close Sunrise.", done: true },
    { date: "Nov 2, 2026", title: "Net savings estimates posted", body: "The posted figures don't include one-time closure costs or the cost of maintaining an empty building.", done: true },
    { date: "Nov 23, 2026", title: "Policy analysis presented to the board", body: "" },
    { date: "Dec 1–3, 2026", title: "Districtwide community sessions", body: "Show up, and bring a neighbor." },
    { date: "Dec 8, 2026 – Mar 8, 2027", title: "School-specific public hearings", body: "Sunrise hearing date to be announced." },
    { date: "Jan – Feb 2027", title: "Committee refines recommendations", body: "" },
    { date: "Mar 8, 2027", title: "Board vote", body: "", key: true },
    { date: "Fall 2028", title: "Earliest any change takes effect", body: "" }
  ],

  sources: [
    { code: "S1", document: "Elementary Closure Net Savings (Northshore SD)", date: "2026-11-02", link: "https://www.nsd.org/fs/resource-manager/view/8b6764e1-211a-489b-be8f-d4407e312792", provides: "Net savings by scenario, fixed cost by closing school, Oct 2026 FTE, added staffing at receiving schools. Case A uses projected 2028 residents; Case B uses October 2026 FTE plus incoming pockets. 2026-27 dollars, general fund." },
    { code: "S2", document: "Transportation Summary Reports (Northshore SD)", date: "2026-10-26", link: "https://www.nsd.org/fs/resource-manager/view/4abfbb5f-59fa-41e9-b05f-b3dc163e0b8a", provides: "New bus riders, ride times, routes. Ride times exclude traffic; based on 2026-27 students." },
    { code: "S3", document: "Resident Projections by School (Northshore SD)", date: "2026-11-06", link: "https://www.nsd.org/fs/resource-manager/view/28eaa9c1-034b-4e85-9791-3df874f7d75b", provides: "Resident students 2023-2026 (actual) and 2027-2030 (projected); classrooms; design capacity (rooms x 22.5, including portables); acres." },
    { code: "S4", document: "Capital Facilities Plan 2026-2032, Table 4.2 (Northshore SD)", date: "2026-06-22", link: "https://snohomishcountywa.gov/DocumentCenter/View/150271/", provides: "Permanent and portable capacity at 20.4 students per teaching station; build and modernization years." },
    { code: "S5", document: "Facility Condition Assessment, Table 8 (Sazan Group for Northshore SD)", date: "2025-04-25", link: "https://www.nsd.org/fs/resource-manager/view/154ed936-2528-4a6b-ac10-de45662e6281", provides: "Corrective work by year 2025-2029 and building square footage." },
    { code: "S6", document: "Woodinville Water District 2022 General Sewer Plan Update, Section 1.9.A", date: "2023-05", link: "", provides: "Which schools are sewered, on a private siphon, or have sewage trucked." },
    { code: "S7", document: "Scenario pages 1, 2, 3 (Northshore SD)", date: "2026-10-26", link: "https://www.nsd.org/fs/pages/15362", provides: "Students changing schools; pockets moved; district's stated rationale." },
    { code: "S8", document: "OSPI Key Performance Indicators, transportation cost per rider", date: "2024-25", link: "https://ospi.k12.wa.us", provides: "Northshore average cost per bus rider, $1,605 (verify current year)." },
    { code: "S9", document: "East Area capacity summary (parent group analysis)", date: "2026-11", link: "", provides: "CFP seats for East Ridge and Wellington; Scenario 1 2030 utilization. Parent analysis, not a district document." },
    { code: "S10", document: "Northshore director district map (2021 redistricting)", date: "2021", link: "https://resources.finalsite.net/images/v1743701683/nsdorg/ikgpylzwooddxbcoz0is/NSDRedistricting-Map-2021.pdf", provides: "Board director districts." }
  ]
};
