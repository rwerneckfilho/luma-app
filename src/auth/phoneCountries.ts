export type PhoneCountry = {
  callingCode: string;
  fallbackName: string;
  flag: string;
  iso2: string;
  maxNationalDigits: number;
  minNationalDigits: number;
};

type PhoneCountryEntry = {
  callingCode: string;
  fallbackName: string;
  iso2: string;
  maxNationalDigits?: number;
  minNationalDigits?: number;
};

export const defaultPhoneCountry = "BR";

const priorityPhoneCountryCodes = [
  "BR",
  "AR",
  "CO",
  "CL",
  "MX",
  "US",
  "CA",
  "UY",
  "PY",
  "PE",
  "ES",
] as const;

const phoneCountryEntries: PhoneCountryEntry[] = [
  { callingCode: "55", fallbackName: "Brazil", iso2: "BR", maxNationalDigits: 11, minNationalDigits: 10 },
  { callingCode: "54", fallbackName: "Argentina", iso2: "AR", maxNationalDigits: 11, minNationalDigits: 10 },
  { callingCode: "57", fallbackName: "Colombia", iso2: "CO", maxNationalDigits: 10, minNationalDigits: 10 },
  { callingCode: "56", fallbackName: "Chile", iso2: "CL", maxNationalDigits: 9, minNationalDigits: 9 },
  { callingCode: "52", fallbackName: "Mexico", iso2: "MX", maxNationalDigits: 10, minNationalDigits: 10 },
  { callingCode: "1", fallbackName: "United States", iso2: "US", maxNationalDigits: 10, minNationalDigits: 10 },
  { callingCode: "1", fallbackName: "Canada", iso2: "CA", maxNationalDigits: 10, minNationalDigits: 10 },
  { callingCode: "598", fallbackName: "Uruguay", iso2: "UY" },
  { callingCode: "595", fallbackName: "Paraguay", iso2: "PY" },
  { callingCode: "51", fallbackName: "Peru", iso2: "PE" },
  { callingCode: "34", fallbackName: "Spain", iso2: "ES" },
  { callingCode: "93", fallbackName: "Afghanistan", iso2: "AF" },
  { callingCode: "358", fallbackName: "Aland Islands", iso2: "AX" },
  { callingCode: "355", fallbackName: "Albania", iso2: "AL" },
  { callingCode: "213", fallbackName: "Algeria", iso2: "DZ" },
  { callingCode: "1", fallbackName: "American Samoa", iso2: "AS" },
  { callingCode: "376", fallbackName: "Andorra", iso2: "AD" },
  { callingCode: "244", fallbackName: "Angola", iso2: "AO" },
  { callingCode: "1", fallbackName: "Anguilla", iso2: "AI" },
  { callingCode: "672", fallbackName: "Antarctica", iso2: "AQ" },
  { callingCode: "1", fallbackName: "Antigua and Barbuda", iso2: "AG" },
  { callingCode: "374", fallbackName: "Armenia", iso2: "AM" },
  { callingCode: "297", fallbackName: "Aruba", iso2: "AW" },
  { callingCode: "61", fallbackName: "Australia", iso2: "AU" },
  { callingCode: "43", fallbackName: "Austria", iso2: "AT" },
  { callingCode: "994", fallbackName: "Azerbaijan", iso2: "AZ" },
  { callingCode: "1", fallbackName: "Bahamas", iso2: "BS" },
  { callingCode: "973", fallbackName: "Bahrain", iso2: "BH" },
  { callingCode: "880", fallbackName: "Bangladesh", iso2: "BD" },
  { callingCode: "1", fallbackName: "Barbados", iso2: "BB" },
  { callingCode: "375", fallbackName: "Belarus", iso2: "BY" },
  { callingCode: "32", fallbackName: "Belgium", iso2: "BE" },
  { callingCode: "501", fallbackName: "Belize", iso2: "BZ" },
  { callingCode: "229", fallbackName: "Benin", iso2: "BJ" },
  { callingCode: "1", fallbackName: "Bermuda", iso2: "BM" },
  { callingCode: "975", fallbackName: "Bhutan", iso2: "BT" },
  { callingCode: "591", fallbackName: "Bolivia", iso2: "BO" },
  { callingCode: "599", fallbackName: "Bonaire, Sint Eustatius and Saba", iso2: "BQ" },
  { callingCode: "387", fallbackName: "Bosnia and Herzegovina", iso2: "BA" },
  { callingCode: "267", fallbackName: "Botswana", iso2: "BW" },
  { callingCode: "47", fallbackName: "Bouvet Island", iso2: "BV" },
  { callingCode: "246", fallbackName: "British Indian Ocean Territory", iso2: "IO" },
  { callingCode: "1", fallbackName: "British Virgin Islands", iso2: "VG" },
  { callingCode: "673", fallbackName: "Brunei", iso2: "BN" },
  { callingCode: "359", fallbackName: "Bulgaria", iso2: "BG" },
  { callingCode: "226", fallbackName: "Burkina Faso", iso2: "BF" },
  { callingCode: "257", fallbackName: "Burundi", iso2: "BI" },
  { callingCode: "855", fallbackName: "Cambodia", iso2: "KH" },
  { callingCode: "237", fallbackName: "Cameroon", iso2: "CM" },
  { callingCode: "238", fallbackName: "Cape Verde", iso2: "CV" },
  { callingCode: "1", fallbackName: "Cayman Islands", iso2: "KY" },
  { callingCode: "236", fallbackName: "Central African Republic", iso2: "CF" },
  { callingCode: "235", fallbackName: "Chad", iso2: "TD" },
  { callingCode: "86", fallbackName: "China", iso2: "CN" },
  { callingCode: "61", fallbackName: "Christmas Island", iso2: "CX" },
  { callingCode: "61", fallbackName: "Cocos Islands", iso2: "CC" },
  { callingCode: "269", fallbackName: "Comoros", iso2: "KM" },
  { callingCode: "682", fallbackName: "Cook Islands", iso2: "CK" },
  { callingCode: "506", fallbackName: "Costa Rica", iso2: "CR" },
  { callingCode: "385", fallbackName: "Croatia", iso2: "HR" },
  { callingCode: "53", fallbackName: "Cuba", iso2: "CU" },
  { callingCode: "599", fallbackName: "Curacao", iso2: "CW" },
  { callingCode: "357", fallbackName: "Cyprus", iso2: "CY" },
  { callingCode: "420", fallbackName: "Czechia", iso2: "CZ" },
  { callingCode: "243", fallbackName: "Democratic Republic of the Congo", iso2: "CD" },
  { callingCode: "45", fallbackName: "Denmark", iso2: "DK" },
  { callingCode: "253", fallbackName: "Djibouti", iso2: "DJ" },
  { callingCode: "1", fallbackName: "Dominica", iso2: "DM" },
  { callingCode: "1", fallbackName: "Dominican Republic", iso2: "DO" },
  { callingCode: "593", fallbackName: "Ecuador", iso2: "EC" },
  { callingCode: "20", fallbackName: "Egypt", iso2: "EG" },
  { callingCode: "503", fallbackName: "El Salvador", iso2: "SV" },
  { callingCode: "240", fallbackName: "Equatorial Guinea", iso2: "GQ" },
  { callingCode: "291", fallbackName: "Eritrea", iso2: "ER" },
  { callingCode: "372", fallbackName: "Estonia", iso2: "EE" },
  { callingCode: "268", fallbackName: "Eswatini", iso2: "SZ" },
  { callingCode: "251", fallbackName: "Ethiopia", iso2: "ET" },
  { callingCode: "500", fallbackName: "Falkland Islands", iso2: "FK" },
  { callingCode: "298", fallbackName: "Faroe Islands", iso2: "FO" },
  { callingCode: "679", fallbackName: "Fiji", iso2: "FJ" },
  { callingCode: "358", fallbackName: "Finland", iso2: "FI" },
  { callingCode: "33", fallbackName: "France", iso2: "FR" },
  { callingCode: "594", fallbackName: "French Guiana", iso2: "GF" },
  { callingCode: "689", fallbackName: "French Polynesia", iso2: "PF" },
  { callingCode: "262", fallbackName: "French Southern Territories", iso2: "TF" },
  { callingCode: "241", fallbackName: "Gabon", iso2: "GA" },
  { callingCode: "220", fallbackName: "Gambia", iso2: "GM" },
  { callingCode: "995", fallbackName: "Georgia", iso2: "GE" },
  { callingCode: "49", fallbackName: "Germany", iso2: "DE" },
  { callingCode: "233", fallbackName: "Ghana", iso2: "GH" },
  { callingCode: "350", fallbackName: "Gibraltar", iso2: "GI" },
  { callingCode: "30", fallbackName: "Greece", iso2: "GR" },
  { callingCode: "299", fallbackName: "Greenland", iso2: "GL" },
  { callingCode: "1", fallbackName: "Grenada", iso2: "GD" },
  { callingCode: "590", fallbackName: "Guadeloupe", iso2: "GP" },
  { callingCode: "1", fallbackName: "Guam", iso2: "GU" },
  { callingCode: "502", fallbackName: "Guatemala", iso2: "GT" },
  { callingCode: "44", fallbackName: "Guernsey", iso2: "GG" },
  { callingCode: "224", fallbackName: "Guinea", iso2: "GN" },
  { callingCode: "245", fallbackName: "Guinea-Bissau", iso2: "GW" },
  { callingCode: "592", fallbackName: "Guyana", iso2: "GY" },
  { callingCode: "509", fallbackName: "Haiti", iso2: "HT" },
  { callingCode: "672", fallbackName: "Heard Island and McDonald Islands", iso2: "HM" },
  { callingCode: "504", fallbackName: "Honduras", iso2: "HN" },
  { callingCode: "852", fallbackName: "Hong Kong", iso2: "HK" },
  { callingCode: "36", fallbackName: "Hungary", iso2: "HU" },
  { callingCode: "354", fallbackName: "Iceland", iso2: "IS" },
  { callingCode: "91", fallbackName: "India", iso2: "IN" },
  { callingCode: "62", fallbackName: "Indonesia", iso2: "ID" },
  { callingCode: "98", fallbackName: "Iran", iso2: "IR" },
  { callingCode: "964", fallbackName: "Iraq", iso2: "IQ" },
  { callingCode: "353", fallbackName: "Ireland", iso2: "IE" },
  { callingCode: "44", fallbackName: "Isle of Man", iso2: "IM" },
  { callingCode: "972", fallbackName: "Israel", iso2: "IL" },
  { callingCode: "39", fallbackName: "Italy", iso2: "IT" },
  { callingCode: "225", fallbackName: "Ivory Coast", iso2: "CI" },
  { callingCode: "1", fallbackName: "Jamaica", iso2: "JM" },
  { callingCode: "81", fallbackName: "Japan", iso2: "JP" },
  { callingCode: "44", fallbackName: "Jersey", iso2: "JE" },
  { callingCode: "962", fallbackName: "Jordan", iso2: "JO" },
  { callingCode: "7", fallbackName: "Kazakhstan", iso2: "KZ" },
  { callingCode: "254", fallbackName: "Kenya", iso2: "KE" },
  { callingCode: "686", fallbackName: "Kiribati", iso2: "KI" },
  { callingCode: "383", fallbackName: "Kosovo", iso2: "XK" },
  { callingCode: "965", fallbackName: "Kuwait", iso2: "KW" },
  { callingCode: "996", fallbackName: "Kyrgyzstan", iso2: "KG" },
  { callingCode: "856", fallbackName: "Laos", iso2: "LA" },
  { callingCode: "371", fallbackName: "Latvia", iso2: "LV" },
  { callingCode: "961", fallbackName: "Lebanon", iso2: "LB" },
  { callingCode: "266", fallbackName: "Lesotho", iso2: "LS" },
  { callingCode: "231", fallbackName: "Liberia", iso2: "LR" },
  { callingCode: "218", fallbackName: "Libya", iso2: "LY" },
  { callingCode: "423", fallbackName: "Liechtenstein", iso2: "LI" },
  { callingCode: "370", fallbackName: "Lithuania", iso2: "LT" },
  { callingCode: "352", fallbackName: "Luxembourg", iso2: "LU" },
  { callingCode: "853", fallbackName: "Macao", iso2: "MO" },
  { callingCode: "261", fallbackName: "Madagascar", iso2: "MG" },
  { callingCode: "265", fallbackName: "Malawi", iso2: "MW" },
  { callingCode: "60", fallbackName: "Malaysia", iso2: "MY" },
  { callingCode: "960", fallbackName: "Maldives", iso2: "MV" },
  { callingCode: "223", fallbackName: "Mali", iso2: "ML" },
  { callingCode: "356", fallbackName: "Malta", iso2: "MT" },
  { callingCode: "692", fallbackName: "Marshall Islands", iso2: "MH" },
  { callingCode: "596", fallbackName: "Martinique", iso2: "MQ" },
  { callingCode: "222", fallbackName: "Mauritania", iso2: "MR" },
  { callingCode: "230", fallbackName: "Mauritius", iso2: "MU" },
  { callingCode: "262", fallbackName: "Mayotte", iso2: "YT" },
  { callingCode: "691", fallbackName: "Micronesia", iso2: "FM" },
  { callingCode: "373", fallbackName: "Moldova", iso2: "MD" },
  { callingCode: "377", fallbackName: "Monaco", iso2: "MC" },
  { callingCode: "976", fallbackName: "Mongolia", iso2: "MN" },
  { callingCode: "382", fallbackName: "Montenegro", iso2: "ME" },
  { callingCode: "1", fallbackName: "Montserrat", iso2: "MS" },
  { callingCode: "212", fallbackName: "Morocco", iso2: "MA" },
  { callingCode: "258", fallbackName: "Mozambique", iso2: "MZ" },
  { callingCode: "95", fallbackName: "Myanmar", iso2: "MM" },
  { callingCode: "264", fallbackName: "Namibia", iso2: "NA" },
  { callingCode: "674", fallbackName: "Nauru", iso2: "NR" },
  { callingCode: "977", fallbackName: "Nepal", iso2: "NP" },
  { callingCode: "31", fallbackName: "Netherlands", iso2: "NL" },
  { callingCode: "687", fallbackName: "New Caledonia", iso2: "NC" },
  { callingCode: "64", fallbackName: "New Zealand", iso2: "NZ" },
  { callingCode: "505", fallbackName: "Nicaragua", iso2: "NI" },
  { callingCode: "227", fallbackName: "Niger", iso2: "NE" },
  { callingCode: "234", fallbackName: "Nigeria", iso2: "NG" },
  { callingCode: "683", fallbackName: "Niue", iso2: "NU" },
  { callingCode: "672", fallbackName: "Norfolk Island", iso2: "NF" },
  { callingCode: "850", fallbackName: "North Korea", iso2: "KP" },
  { callingCode: "389", fallbackName: "North Macedonia", iso2: "MK" },
  { callingCode: "1", fallbackName: "Northern Mariana Islands", iso2: "MP" },
  { callingCode: "47", fallbackName: "Norway", iso2: "NO" },
  { callingCode: "968", fallbackName: "Oman", iso2: "OM" },
  { callingCode: "92", fallbackName: "Pakistan", iso2: "PK" },
  { callingCode: "680", fallbackName: "Palau", iso2: "PW" },
  { callingCode: "970", fallbackName: "Palestine", iso2: "PS" },
  { callingCode: "507", fallbackName: "Panama", iso2: "PA" },
  { callingCode: "675", fallbackName: "Papua New Guinea", iso2: "PG" },
  { callingCode: "63", fallbackName: "Philippines", iso2: "PH" },
  { callingCode: "64", fallbackName: "Pitcairn Islands", iso2: "PN" },
  { callingCode: "48", fallbackName: "Poland", iso2: "PL" },
  { callingCode: "351", fallbackName: "Portugal", iso2: "PT" },
  { callingCode: "1", fallbackName: "Puerto Rico", iso2: "PR" },
  { callingCode: "974", fallbackName: "Qatar", iso2: "QA" },
  { callingCode: "242", fallbackName: "Republic of the Congo", iso2: "CG" },
  { callingCode: "262", fallbackName: "Reunion", iso2: "RE" },
  { callingCode: "40", fallbackName: "Romania", iso2: "RO" },
  { callingCode: "7", fallbackName: "Russia", iso2: "RU" },
  { callingCode: "250", fallbackName: "Rwanda", iso2: "RW" },
  { callingCode: "590", fallbackName: "Saint Barthelemy", iso2: "BL" },
  { callingCode: "290", fallbackName: "Saint Helena", iso2: "SH" },
  { callingCode: "1", fallbackName: "Saint Kitts and Nevis", iso2: "KN" },
  { callingCode: "1", fallbackName: "Saint Lucia", iso2: "LC" },
  { callingCode: "590", fallbackName: "Saint Martin", iso2: "MF" },
  { callingCode: "508", fallbackName: "Saint Pierre and Miquelon", iso2: "PM" },
  { callingCode: "1", fallbackName: "Saint Vincent and the Grenadines", iso2: "VC" },
  { callingCode: "685", fallbackName: "Samoa", iso2: "WS" },
  { callingCode: "378", fallbackName: "San Marino", iso2: "SM" },
  { callingCode: "239", fallbackName: "Sao Tome and Principe", iso2: "ST" },
  { callingCode: "966", fallbackName: "Saudi Arabia", iso2: "SA" },
  { callingCode: "221", fallbackName: "Senegal", iso2: "SN" },
  { callingCode: "381", fallbackName: "Serbia", iso2: "RS" },
  { callingCode: "248", fallbackName: "Seychelles", iso2: "SC" },
  { callingCode: "232", fallbackName: "Sierra Leone", iso2: "SL" },
  { callingCode: "65", fallbackName: "Singapore", iso2: "SG" },
  { callingCode: "1", fallbackName: "Sint Maarten", iso2: "SX" },
  { callingCode: "421", fallbackName: "Slovakia", iso2: "SK" },
  { callingCode: "386", fallbackName: "Slovenia", iso2: "SI" },
  { callingCode: "677", fallbackName: "Solomon Islands", iso2: "SB" },
  { callingCode: "252", fallbackName: "Somalia", iso2: "SO" },
  { callingCode: "27", fallbackName: "South Africa", iso2: "ZA" },
  { callingCode: "500", fallbackName: "South Georgia and the South Sandwich Islands", iso2: "GS" },
  { callingCode: "82", fallbackName: "South Korea", iso2: "KR" },
  { callingCode: "211", fallbackName: "South Sudan", iso2: "SS" },
  { callingCode: "94", fallbackName: "Sri Lanka", iso2: "LK" },
  { callingCode: "249", fallbackName: "Sudan", iso2: "SD" },
  { callingCode: "597", fallbackName: "Suriname", iso2: "SR" },
  { callingCode: "47", fallbackName: "Svalbard and Jan Mayen", iso2: "SJ" },
  { callingCode: "46", fallbackName: "Sweden", iso2: "SE" },
  { callingCode: "41", fallbackName: "Switzerland", iso2: "CH" },
  { callingCode: "963", fallbackName: "Syria", iso2: "SY" },
  { callingCode: "886", fallbackName: "Taiwan", iso2: "TW" },
  { callingCode: "992", fallbackName: "Tajikistan", iso2: "TJ" },
  { callingCode: "255", fallbackName: "Tanzania", iso2: "TZ" },
  { callingCode: "66", fallbackName: "Thailand", iso2: "TH" },
  { callingCode: "670", fallbackName: "Timor-Leste", iso2: "TL" },
  { callingCode: "228", fallbackName: "Togo", iso2: "TG" },
  { callingCode: "690", fallbackName: "Tokelau", iso2: "TK" },
  { callingCode: "676", fallbackName: "Tonga", iso2: "TO" },
  { callingCode: "1", fallbackName: "Trinidad and Tobago", iso2: "TT" },
  { callingCode: "216", fallbackName: "Tunisia", iso2: "TN" },
  { callingCode: "90", fallbackName: "Turkey", iso2: "TR" },
  { callingCode: "993", fallbackName: "Turkmenistan", iso2: "TM" },
  { callingCode: "1", fallbackName: "Turks and Caicos Islands", iso2: "TC" },
  { callingCode: "688", fallbackName: "Tuvalu", iso2: "TV" },
  { callingCode: "1", fallbackName: "U.S. Virgin Islands", iso2: "VI" },
  { callingCode: "256", fallbackName: "Uganda", iso2: "UG" },
  { callingCode: "380", fallbackName: "Ukraine", iso2: "UA" },
  { callingCode: "971", fallbackName: "United Arab Emirates", iso2: "AE" },
  { callingCode: "44", fallbackName: "United Kingdom", iso2: "GB" },
  { callingCode: "1", fallbackName: "United States Minor Outlying Islands", iso2: "UM" },
  { callingCode: "998", fallbackName: "Uzbekistan", iso2: "UZ" },
  { callingCode: "678", fallbackName: "Vanuatu", iso2: "VU" },
  { callingCode: "39", fallbackName: "Vatican City", iso2: "VA" },
  { callingCode: "58", fallbackName: "Venezuela", iso2: "VE" },
  { callingCode: "84", fallbackName: "Vietnam", iso2: "VN" },
  { callingCode: "681", fallbackName: "Wallis and Futuna", iso2: "WF" },
  { callingCode: "212", fallbackName: "Western Sahara", iso2: "EH" },
  { callingCode: "967", fallbackName: "Yemen", iso2: "YE" },
  { callingCode: "260", fallbackName: "Zambia", iso2: "ZM" },
  { callingCode: "263", fallbackName: "Zimbabwe", iso2: "ZW" },
];

export const phoneCountries: PhoneCountry[] = phoneCountryEntries.map((country) => ({
  ...country,
  flag: getFlagEmoji(country.iso2),
  maxNationalDigits: country.maxNationalDigits ?? Math.max(4, 15 - country.callingCode.length),
  minNationalDigits: country.minNationalDigits ?? 4,
}));

export type PhoneCountryCode = string;

const phoneCountryByIso = new Map<string, PhoneCountry>(
  phoneCountries.map((country) => [country.iso2, country]),
);

const priorityPhoneCountryCodeSet = new Set<string>(priorityPhoneCountryCodes);

function getFlagEmoji(iso2: string) {
  if (!/^[A-Z]{2}$/.test(iso2)) {
    return "🏳";
  }

  return String.fromCodePoint(
    ...[...iso2].map((character) => 0x1f1e6 + character.charCodeAt(0) - 65),
  );
}

export function getPhoneCountry(iso2?: string | null) {
  return phoneCountryByIso.get(iso2 ?? "") ?? phoneCountryByIso.get(defaultPhoneCountry)!;
}

export function isSupportedPhoneCountry(iso2?: string | null): iso2 is PhoneCountryCode {
  return phoneCountryByIso.has(iso2 ?? "");
}

export function digitsOnly(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export function getLocalizedPhoneCountryName(
  iso2: string,
  locale: string,
  fallbackName: string,
) {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return displayNames.of(iso2) ?? fallbackName;
  } catch {
    return fallbackName;
  }
}

export function getLocalizedPhoneCountries(locale: string) {
  const collator = new Intl.Collator([locale], { sensitivity: "base" });
  const priorityCountries = priorityPhoneCountryCodes.map((iso2) => getPhoneCountry(iso2));
  const remainingCountries = phoneCountries
    .filter((country) => !priorityPhoneCountryCodeSet.has(country.iso2))
    .sort((first, second) => {
      const firstName = getLocalizedPhoneCountryName(first.iso2, locale, first.fallbackName);
      const secondName = getLocalizedPhoneCountryName(second.iso2, locale, second.fallbackName);
      return collator.compare(firstName, secondName) || first.iso2.localeCompare(second.iso2);
    });

  return [...priorityCountries, ...remainingCountries];
}

export function getNationalPhoneExample(iso2?: string | null) {
  switch (getPhoneCountry(iso2).iso2) {
    case "BR":
      return "(61) 98166-4655";
    case "AR":
      return "11 15-1234-5678";
    case "CO":
      return "300 123 4567";
    case "CL":
      return "9 1234 5678";
    case "MX":
      return "55 1234 5678";
    case "US":
    case "CA":
      return "(202) 555-0123";
    default:
      return "123456789";
  }
}

export function formatNationalPhone(iso2: string, value: string) {
  const country = getPhoneCountry(iso2);
  const digits = digitsOnly(value).slice(0, country.maxNationalDigits);

  if (country.iso2 === "BR") {
    if (digits.length <= 2) return digits;
    const area = digits.slice(0, 2);
    const local = digits.slice(2);
    if (local.length <= 4) return `(${area}) ${local}`;
    if (local.length <= 8) return `(${area}) ${local.slice(0, 4)}-${local.slice(4)}`;
    return `(${area}) ${local.slice(0, 5)}-${local.slice(5)}`;
  }

  if (country.iso2 === "AR") {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  if (country.iso2 === "CO") {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  if (country.iso2 === "CL") {
    if (digits.length <= 1) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
    return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`;
  }

  if (country.iso2 === "MX") {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }

  if (country.iso2 === "US" || country.iso2 === "CA") {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

export function isValidNationalPhone(iso2: string, value: string) {
  const country = getPhoneCountry(iso2);
  const digits = digitsOnly(value);
  const normalizedLength = country.callingCode.length + digits.length;

  return (
    digits.length >= country.minNationalDigits &&
    digits.length <= country.maxNationalDigits &&
    normalizedLength <= 15
  );
}

export function normalizePhoneForSubmit(iso2: string, value: string) {
  const country = getPhoneCountry(iso2);
  return `${country.callingCode}${digitsOnly(value)}`;
}
