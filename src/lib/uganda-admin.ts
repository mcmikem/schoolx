export interface UgandaDistrictDirectoryEntry {
  district: string;
  subcounties: readonly string[];
  parishes: Record<string, readonly string[]>;
}

export const UGANDA_DISTRICT_DIRECTORY: readonly UgandaDistrictDirectoryEntry[] = [
  {
    district: "Kampala",
    subcounties: ["Central Division", "Kawempe Division", "Makindye Division", "Nakawa Division", "Rubaga Division"],
    parishes: {
      "Central Division": ["Nakasero", "Old Kampala", "Kololo"],
      "Kawempe Division": ["Bwaise", "Kazo", "Kyebando"],
      "Makindye Division": ["Kibuye", "Lukuli", "Nsambya"],
      "Nakawa Division": ["Bugolobi", "Naguru", "Ntinda"],
      "Rubaga Division": ["Mengo", "Mutundwe", "Ndejje"],
    },
  },
  {
    district: "Wakiso",
    subcounties: ["Busiro", "Kyadondo", "Makindye-Ssabagabo", "Entebbe Municipality"],
    parishes: {
      Busiro: ["Bulenga", "Nansana", "Wakiso Town"],
      Kyadondo: ["Kira", "Kyaliwajjala", "Namugongo"],
      "Makindye-Ssabagabo": ["Bunamwaya", "Kansanga", "Seguku"],
      "Entebbe Municipality": ["Katabi", "Division A", "Division B"],
    },
  },
  {
    district: "Mukono",
    subcounties: ["Mukono TC", "Goma", "Ntenjeru", "Nama"],
    parishes: {
      "Mukono TC": ["Central Ward", "Ggulu", "Nsambwe"],
      Goma: ["Kyaggwe", "Mbalala", "Seeta"],
      Ntenjeru: ["Ntenjeru", "Kisoga", "Ntunda"],
      Nama: ["Nama", "Nakisunga", "Bajjo"],
    },
  },
  {
    district: "Jinja",
    subcounties: ["Jinja South", "Jinja North", "Budondo", "Mafubira"],
    parishes: {
      "Jinja South": ["Mpumudde", "Walukuba", "Bugembe"],
      "Jinja North": ["Kimaka", "Nalufenya", "Buwenge"],
      Budondo: ["Buwenge", "Masese", "Wanyange"],
      Mafubira: ["Mafubira", "Kakira", "Wakitaka"],
    },
  },
  {
    district: "Mbale",
    subcounties: ["Industrial Division", "Northern Division", "Wanale", "Bungokho"],
    parishes: {
      "Industrial Division": ["Mission Cell", "Namakwekwe", "Nkoma"],
      "Northern Division": ["Busamaga", "Namatala", "Nakaloke"],
      Wanale: ["Mooni", "Busiu", "Namanyonyi"],
      Bungokho: ["Bumbo", "Bukonde", "Mutoto"],
    },
  },
  {
    district: "Gulu",
    subcounties: ["Pece", "Laroo-Pece", "Bardege", "Layibi"],
    parishes: {
      Pece: ["Pece Prison", "Kasubi", "Bobi"],
      "Laroo-Pece": ["Laroo", "Pawel", "Unyama"],
      Bardege: ["Bardege", "Awach", "Bungatira"],
      Layibi: ["Layibi", "Patiko", "Lacor"],
    },
  },
  {
    district: "Lira",
    subcounties: ["Lira Central", "Ojwina", "Adyel", "Barapwo"],
    parishes: {
      "Lira Central": ["Senior Quarters", "Railway", "Market"],
      Ojwina: ["Ojwina", "Ireda", "Akia"],
      Adyel: ["Adyel", "Ngetta", "Adekokwok"],
      Barapwo: ["Barapwo", "Amach", "Aromo"],
    },
  },
  {
    district: "Masaka",
    subcounties: ["Kimaanya-Kabonera", "Nyendo-Mukungwe", "Kimanya", "Bukakata"],
    parishes: {
      "Kimaanya-Kabonera": ["Kimaanya", "Kabonera", "Bwala"],
      "Nyendo-Mukungwe": ["Nyendo", "Mukungwe", "Kitovu"],
      Kimanya: ["Kimanya", "Ssenyange", "Bwala"],
      Bukakata: ["Bukakata", "Buwunga", "Banda"],
    },
  },
  {
    district: "Mbarara",
    subcounties: ["Nyamitanga", "Kakoba", "Kamukuzi", "Biharwe"],
    parishes: {
      Nyamitanga: ["Nyamitanga", "Kenkombe", "Rwentondo"],
      Kakoba: ["Kakoba", "Ruti", "Katete"],
      Kamukuzi: ["Kamukuzi", "Kakyeka", "Kagongi"],
      Biharwe: ["Biharwe", "Rubaya", "Bwizibwera"],
    },
  },
  {
    district: "Fort Portal",
    subcounties: ["Central Division", "South Division", "East Division", "West Division"],
    parishes: {
      "Central Division": ["Rwengoma", "Boma", "Kagote"],
      "South Division": ["Kijanju", "Buhinga", "Kitumba"],
      "East Division": ["Kisenyi", "Bukwali", "Karambi"],
      "West Division": ["Hakibaale", "Mugunu", "Kitembe"],
    },
  },
  {
    district: "Kabale",
    subcounties: ["Central Division", "Southern Division", "Northern Division", "Katuna"],
    parishes: {
      "Central Division": ["Central Ward", "Kirigime", "Rushaki"],
      "Southern Division": ["Nyabikoni", "Rugarama", "Kikungiri"],
      "Northern Division": ["Buhara", "Kyanamira", "Kyanamukaka"],
      Katuna: ["Katuna", "Kyanika", "Muko"],
    },
  },
  {
    district: "Soroti",
    subcounties: ["Soroti East", "Soroti West", "Aukot", "Gweri"],
    parishes: {
      "Soroti East": ["Awoja", "Asuret", "Pamba"],
      "Soroti West": ["Madera", "Nakatunya", "Awoja Bridge"],
      Aukot: ["Aukot", "Katine", "Arapai"],
      Gweri: ["Gweri", "Awoja", "Tubur"],
    },
  },
  {
    district: "Arua",
    subcounties: ["Arua Central", "River Oli", "Ayivu", "Vurra"],
    parishes: {
      "Arua Central": ["Bazaar", "Mvara", "Awindiri"],
      "River Oli": ["Pokea", "Pajulu", "Onduparaka"],
      Ayivu: ["Ayivu", "Ediofe", "Pajulu"],
      Vurra: ["Odravu", "Logiri", "Vurra"],
    },
  },
  {
    district: "Hoima",
    subcounties: ["Mparo", "Kahoora", "Buhanika", "Kyabigambire"],
    parishes: {
      Mparo: ["Mparo", "Bulera", "Kibingo"],
      Kahoora: ["Kahoora", "Bwikya", "Busiisi"],
      Buhanika: ["Buhanika", "Kigorobya", "Bombo"],
      Kyabigambire: ["Kyabigambire", "Kiganja", "Buseruka"],
    },
  },
  {
    district: "Masindi",
    subcounties: ["Central Division", "Nyangahya", "Karujubu", "Kimengo"],
    parishes: {
      "Central Division": ["Central", "Kijura", "Kibwona"],
      Nyangahya: ["Nyangahya", "Kimina", "Nyabinyegera"],
      Karujubu: ["Karujubu", "Bwijanga", "Pakanyi"],
      Kimengo: ["Kimengo", "Miirya", "Kisanja"],
    },
  },
  {
    district: "Tororo",
    subcounties: ["Eastern Division", "Western Division", "Mukuju", "Malaba"],
    parishes: {
      "Eastern Division": ["Central Ward", "Kasoli", "Osukuru"],
      "Western Division": ["Western Ward", "Molo", "Petta"],
      Mukuju: ["Mukuju", "Nagongera", "Merikit"],
      Malaba: ["Malaba", "Angorom", "Iyolwa"],
    },
  },
  {
    district: "Busia",
    subcounties: ["Busia TC", "Masafu", "Lumino", "Buteba"],
    parishes: {
      "Busia TC": ["Marachi", "Solo", "Dabani"],
      Masafu: ["Masafu", "Sikuda", "Buchicha"],
      Lumino: ["Lumino", "Majanji", "Buhehe"],
      Buteba: ["Buteba", "Bulumbi", "Buyengo"],
    },
  },
  {
    district: "Iganga",
    subcounties: ["Iganga Central", "Nakalama", "Bulamagi", "Nambale"],
    parishes: {
      "Iganga Central": ["Central Ward", "Busei", "Mbulamuti"],
      Nakalama: ["Nakalama", "Buwenge", "Nabitende"],
      Bulamagi: ["Bulamagi", "Nawandala", "Bukoyo"],
      Nambale: ["Nambale", "Nawanyago", "Namungalwe"],
    },
  },
  {
    district: "Kamuli",
    subcounties: ["Northern Division", "Southern Division", "Bugabula", "Kitayunjwa"],
    parishes: {
      "Northern Division": ["Northern Ward", "Kasambira", "Mbulamuti"],
      "Southern Division": ["Southern Ward", "Namasagali", "Balawoli"],
      Bugabula: ["Bugabula", "Nabwigulu", "Buwenge"],
      Kitayunjwa: ["Kitayunjwa", "Nankandulo", "Mbulamuti"],
    },
  },
  {
    district: "Apac",
    subcounties: ["Apoi", "Ibuje", "Chegere", "Maruzi"],
    parishes: {
      Apoi: ["Apoi", "Aduku", "Abongomola"],
      Ibuje: ["Ibuje", "Arocha", "Atopi"],
      Chegere: ["Chegere", "Akokoro", "Inomo"],
      Maruzi: ["Maruzi", "Akwon", "Atar"],
    },
  },
  {
    district: "Entebbe",
    subcounties: ["Division A", "Division B", "Katabi", "Kitoro"],
    parishes: {
      "Division A": ["Kiwafu", "Katabi", "Kiwafu West"],
      "Division B": ["Bulega", "Kitoro", "Lugonjo"],
      Katabi: ["Katabi", "Abayita Ababiri", "Lweza"],
      Kitoro: ["Kitoro", "Kigungu", "Nakiwogo"],
    },
  },
  {
    district: "Kasese",
    subcounties: ["Kasese Municipality", "Bulembia", "Kisinga", "Hima"],
    parishes: {
      "Kasese Municipality": ["Central", "Nyamwamba", "Kilembe"],
      Bulembia: ["Bulembia", "Kyalhumba", "Kitswamba"],
      Kisinga: ["Kisinga", "Munkunyu", "Kagando"],
      Hima: ["Hima", "Karusandara", "Muhokya"],
    },
  },
  {
    district: "Kitgum",
    subcounties: ["Kitgum Municipality", "Labongo", "Mucwini", "Pajimo"],
    parishes: {
      "Kitgum Municipality": ["Central", "Pager", "Pandwong"],
      Labongo: ["Labongo", "Namokora", "Akwang"],
      Mucwini: ["Mucwini", "Lukwor", "Akwang"],
      Pajimo: ["Pajimo", "Palabek", "Akworo"],
    },
  },
  {
    district: "Moroto",
    subcounties: ["South Division", "North Division", "Katikekile", "Nadunget"],
    parishes: {
      "South Division": ["South Ward", "Naitakwae", "Nadunget"],
      "North Division": ["North Ward", "Camp Swahili", "Singila"],
      Katikekile: ["Katikekile", "Lopedot", "Nadiket"],
      Nadunget: ["Nadunget", "Tapac", "Rupa"],
    },
  },
] as const;

export function getDistrictOptions() {
  return UGANDA_DISTRICT_DIRECTORY.map((entry) => ({
    value: entry.district,
    label: entry.district,
  }));
}

export function getSubcountyOptions(district?: string) {
  const entry = UGANDA_DISTRICT_DIRECTORY.find((item) => item.district === district);
  return (entry?.subcounties || []).map((subcounty) => ({
    value: subcounty,
    label: subcounty,
  }));
}

export function getParishOptions(district?: string, subcounty?: string) {
  const entry = UGANDA_DISTRICT_DIRECTORY.find((item) => item.district === district);
  return (entry?.parishes[subcounty || ""] || []).map((parish) => ({
    value: parish,
    label: parish,
  }));
}
