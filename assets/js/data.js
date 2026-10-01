const FILES = {
  meta: './data/meta.json',
  systems: './data/systems.json',
  datasetTypes: './data/dataset-types.json',
  mappings: './data/mappings.json',
  notices: './data/notices.json',
  odtaSpecification: './data/odta-place-specification.json',
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function fold(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de');
}

export async function loadData() {
  const [meta, systems, datasetTypes, mappings, notices, odtaSpecification] = await Promise.all(
    Object.values(FILES).map(fetchJson),
  );
  const systemById = new Map(systems.map((system) => [system.id, system]));
  const datasetById = new Map(datasetTypes.map((type) => [type.id, type]));
  const aliasToDataset = new Map();
  for (const type of datasetTypes) {
    aliasToDataset.set(fold(type.id), type.id);
    for (const alias of type.sourceAliases ?? []) aliasToDataset.set(fold(alias), type.id);
  }

  function datasetIdFor(mapping) {
    const targetType = mapping.targets.find((target) => target.datasetType)?.datasetType;
    if (targetType && datasetById.has(targetType)) return targetType;
    return aliasToDataset.get(fold(mapping.source.datasetType)) ?? null;
  }

  for (const mapping of mappings) mapping.datasetTypeId = datasetIdFor(mapping);

  const shapeById = new Map();
  function indexShapes(value) {
    if (Array.isArray(value)) {
      value.forEach(indexShapes);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (value['@id'] && (value['sh:property'] || value['ds:propertyDisplayOrder'])) shapeById.set(value['@id'], value);
    Object.values(value).forEach(indexShapes);
  }
  indexShapes(odtaSpecification['@graph']);
  const poiSpecification = [...shapeById.values()].find((shape) => (shape['sh:property'] ?? [])
    .some((property) => property['sh:path'] === 'odta:kindOfPOI'));

  return { meta, systems, datasetTypes, mappings, notices, odtaSpecification, shapeById, poiSpecification, systemById, datasetById, fold };
}
