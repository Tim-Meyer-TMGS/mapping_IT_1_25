// Export field metadata and documented mappings; never include test values.
export function createSpecification(data) {
  return {
    '@context': {
      ds: 'https://vocab.sti2.at/ds/', schema: 'https://schema.org/',
      sh: 'http://www.w3.org/ns/shacl#', hub: 'urn:satourn:documentation:',
      'sh:path': { '@type': '@id' }, 'sh:targetClass': { '@type': '@id' },
      'ds:propertyDisplayOrder': { '@container': '@list', '@type': '@id' },
      'hub:inferredDatatype': { '@type': '@id' }, 'hub:rules': { '@type': '@json' },
    },
    '@graph': data.datasetTypes.map(type => {
      const fields = data.fields.filter(field => field.datasetType === type.id);
      const rules = data.rules.filter(rule => rule.source?.datasetType === type.id || rule.target?.datasetType === type.id);
      const id = field => `urn:satourn:field:${encodeURIComponent(type.id)}:${encodeURIComponent(field.field)}`;
      return {
        '@id': `urn:satourn:specification:${type.id}`, '@type': 'ds:DomainSpecification',
        'ds:grammarNodeType': 'RootNode', 'schema:name': type.label,
        'sh:targetClass': `urn:satourn:type:${type.id}`,
        'ds:propertyDisplayOrder': fields.map(id),
        'sh:property': fields.map(field => ({
          '@type': 'sh:PropertyShape', 'ds:grammarNodeType': 'Property',
          'sh:path': id(field), 'schema:name': field.field,
          'hub:constraintStatus': 'Pflichtstatus und Kardinalität nicht dokumentiert; Feldtyp gegebenenfalls abgeleitet',
          'hub:typeStatus': field.fieldType.status, 'hub:typeLabel': field.fieldType.label,
          ...(field.fieldType.datatype ? { 'hub:inferredDatatype': field.fieldType.datatype } : {}),
          'hub:xmlNamespaces': field.namespaces,
          'hub:mappingRule': rules.filter(rule => rule.target?.datasetType === type.id && rule.target?.field === field.field).map(rule => ({ '@id': `urn:satourn:rule:${rule.id}` })),
        })),
        'hub:rules': rules,
      };
    }),
  };
}

export function bindModel(root, data) {
  root.querySelector('[data-export-spec]')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createSpecification(data), null, 2)], { type: 'application/ld+json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'satourn-datenmodell.jsonld'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
