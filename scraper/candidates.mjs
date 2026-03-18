export const candidates = [
  {
    id: 'magyar',
    name: 'Magyar Péter',
    party: 'Tisza Párt',
    betlabelPlayerId: 278536562,
    polymarketName: 'Peter Magyar',
  },
  {
    id: 'orban',
    name: 'Orbán Viktor',
    party: 'Fidesz–KDNP',
    betlabelPlayerId: 161599662,
    polymarketName: 'Viktor Orban',
  },
  {
    id: 'dobrev',
    name: 'Dobrev Klára',
    party: 'DK',
    betlabelPlayerId: 278536154,
    polymarketName: 'Klara Dobrev',
  },
  {
    id: 'toroczkai',
    name: 'Toroczkai László',
    party: 'Mi Hazánk',
    betlabelPlayerId: 278536677,
    polymarketName: 'Laszlo Toroczkai',
  },
  {
    id: 'lazar',
    name: 'Lázár János',
    party: '',
    betlabelPlayerId: 284103990,
    polymarketName: 'Janos Lazar',
  },
  {
    id: 'kapitany',
    name: 'Kapitány István',
    party: '',
    betlabelPlayerId: 284103991,
    polymarketName: 'Istvan Kapitany',
  },
];

export const playerIdMap = Object.fromEntries(
  candidates.map((c) => [c.betlabelPlayerId, c.id])
);
