param(
    [Parameter(Mandatory)][string]$XsltDirectory,
    [Parameter(Mandatory)][string]$SchemaDirectory,
    [Parameter(Mandatory)][string]$EditorDirectory
)

$ErrorActionPreference = 'Stop'
$stylesheets = [ordered]@{
    tour = 'Tour.xslt'
    event = 'Veranstaltung.xslt'
    poi = 'Poi.xslt'
    gastro = 'Gastro.xslt'
}
$editorNames = [ordered]@{
    tour = 'Tour'; event = 'Veranstaltung'; poi = 'Poi'; gastro = 'Gastro'
    accommodation = 'Vermieter'; package = 'GlobalePauschale'
}
$xsl = 'http://www.w3.org/1999/XSL/Transform'
$root = Split-Path $PSScriptRoot
$observations = Get-Content -LiteralPath (Join-Path $root 'source/field-mapping-observations.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$documentedFeatures = (Get-Content -LiteralPath (Join-Path $root 'data/mapping-hub-authoritative.json') -Raw -Encoding UTF8 | ConvertFrom-Json).rules |
    Where-Object { $_.source.dimension -eq 'feature' -and $_.ruleKind -eq 'mapping' }

function Read-Xml($path) {
    [xml]([IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path).TrimStart())
}

$fieldLabels = @{}
$tree = Read-Xml (Join-Path $SchemaDirectory 'PoiMerkmalTree.xml')
$xmlNamespace = [System.Xml.XmlNamespaceManager]::new($tree.NameTable)
foreach ($category in $tree.SelectNodes('//Category[@InternalName]')) {
    $label = $category.SelectSingleNode('DisplayName[@xml:lang="de-DE"]', $xmlNamespace).InnerText
    if ($label) { $fieldLabels[$category.GetAttribute('InternalName')] = $label.Trim() }
}
$schema = Read-Xml (Join-Path $SchemaDirectory 'Poi_Basis.xsd.xml')
foreach ($element in $schema.SelectNodes('//*[local-name()="element" and @name]')) {
    $label = $element.Attributes | Where-Object LocalName -eq 'DisplayName' | Select-Object -First 1 -ExpandProperty Value
    if ($label) { $fieldLabels[$element.GetAttribute('name')] = $label.Trim() }
}
$verifiedLabels = @{ poi = $fieldLabels; tour = @{}; gastro = @{}; event = @{} }
foreach ($example in $observations.examples) {
    foreach ($entry in $example.satournFieldLabels) {
        $verifiedLabels[$example.datasetType][$entry.field] = $entry.label
    }
}

# The import and editor stylesheets have the same filenames but different roles.
# Only sections linked from the editor's tab bar participate in field locations.
$editors = @{}
foreach ($type in $editorNames.Keys) {
    $name = $editorNames[$type]
    $layout = Read-Xml (Join-Path $EditorDirectory "$name.xslt")
    $captions = @{}
    foreach ($link in $layout.SelectNodes('//*[@id="tabs"]/ul//a[@href] | //h3/a[@id]')) {
        $caption = $link.SelectSingleNode('./*[local-name()="value-of"]/@select').Value
        if ($caption -cmatch "^methods:Translate\('([^']+)'\)$") {
            $key = if ($link.GetAttribute('href') -eq '#') { $link.id -creplace '_link$', '_content' } else { $link.href.TrimStart('#') }
            $captions[$key] = $Matches[1]
        }
    }
    $byName = @{}
    $byGroup = @{}
    foreach ($select in $layout.SelectNodes('//*[@id="tabs"]//*/@select')) {
        $tab = $select.OwnerElement.SelectSingleNode('ancestor::div[contains(concat(" ",normalize-space(@class)," ")," tab ")][1]')
        if (!$tab -or !$captions[$tab.id]) { continue }
        $section = $select.OwnerElement.SelectSingleNode('ancestor::div[@id and contains(@id,"_content")][1]')
        $path = $captions[$tab.id]
        if ($section -and $captions[$section.id] -and $captions[$section.id] -ne $path) { $path += " → $($captions[$section.id])" }
        foreach ($reference in [regex]::Matches($select.Value, "BinderElement\[(Name|Group)='([^']+)'\]")) {
            $index = if ($reference.Groups[1].Value -eq 'Name') { $byName } else { $byGroup }
            $field = $reference.Groups[2].Value
            $index[$field] = @($index[$field] | Where-Object { $_ }) + @($path) | Select-Object -Unique
        }
    }
    $definitions = @{}
    foreach ($suffix in '_Basis.xsd', '.xsd') {
        $editorSchema = Read-Xml (Join-Path $EditorDirectory "$name$suffix")
        foreach ($element in $editorSchema.SelectNodes('//*[local-name()="element" and @name]')) {
            $params = $element.GetNamespaceOfPrefix('params')
            if (!$params) { continue }
            $field = $element.GetAttribute('name')
            $group = $element.GetAttribute('Group', $params)
            $label = $element.GetAttribute('DisplayName', $params).Trim()
            $hidden = $element.GetAttribute('Hidden', $params) -eq 'true'
            if ($group -or $label -or $hidden) { $definitions[$field] = @{ label = $label; group = $group; hidden = $hidden } }
        }
    }
    $valuePaths = @{}
    $tree = Read-Xml (Join-Path $EditorDirectory "${name}MerkmalTree.xml")
    foreach ($feature in $tree.SelectNodes('//Category[not(Category)]')) {
        $label = $feature.SelectSingleNode('DisplayName[@*[name()="xml:lang" and .="de-DE"]]').InnerText
        $field = $feature.GetAttribute('InternalName')
        if (!$field) { $field = $feature.GetAttribute('Name') }
        if ($field -and $label -and $verifiedLabels.ContainsKey($type) -and !$verifiedLabels[$type][$field]) { $verifiedLabels[$type][$field] = $label.Trim() }
        if ($label -and $byName['Merkmal']) { $valuePaths[$label.Trim()] = @($byName['Merkmal']) }
    }
    $editors[$type] = @{ fields = $definitions; byGroup = $byGroup; byName = $byName; valuePaths = $valuePaths }
}

$eventEditorFields = @{
    Latitude = 'VO_OBJECT_CONTACT_LATITUDE'
    Longitude = 'VO_OBJECT_CONTACT_LONGITUDE'
    VO_LAT = 'VO_OBJECT_CONTACT_LATITUDE'
    VO_LON = 'VO_OBJECT_CONTACT_LONGITUDE'
}
# Outdooractive's event import and the editor use different field names for the
# same contact roles. Link only fields with a matching meaning in both sources.
$eventContactFields = @{
    NAME = 'NAME'; STREET = 'STRASSE'; DISTRICT = 'ORTSTEIL'; CITYID = 'ORTID'
    TEL = 'TEL'; MOBIL = 'MOBIL'; FAX = 'FAX'; EMAIL = 'EMAIL'; LINK = 'WEBSEITE1'
}
foreach ($role in 'VO', 'VA', 'AP') {
    foreach ($name in $eventContactFields.Keys) {
        $eventEditorFields["${role}_$name"] = "${role}_OBJECT_CONTACT_$($eventContactFields[$name])"
    }
}

function Add-EditorLocation($target, $type, $field, $featureValue) {
    $editor = $editors[$type]
    if ($type -eq 'event' -and $eventEditorFields[$field]) { $field = $eventEditorFields[$field] }
    $definition = $editor.fields[$field]
    if ($definition -and !$definition.hidden -and $definition.label) { $target.displayLabel = $definition.label }
    $paths = if ($definition -and !$definition.hidden -and $definition.group -and $editor.byGroup[$definition.group]) {
        $editor.byGroup[$definition.group]
    } else { $editor.byName[$field] }
    if (!$paths -and $featureValue) { $paths = $editor.valuePaths[$featureValue] }
    if ($paths) { $target.paths = @($paths) }
    $target
}

$fallbackLabels = @{
    INFO_FAMILIENFREUNDLICH = 'Familienfreundlich'
    INFO_EINKEHRMOEGLICHKEIT = 'Einkehrmöglichkeit'
    INFO_RUNDWEG = 'Rundweg'
    INFO_KULTURELL = 'Kulturell interessant'
    INFO_NATURHIGHLIGHT = 'Natur Highlight'
    OBJECT_FIT_FAMILIE = 'Familienfreundlich'
}

$basisLabels = @{
    OBJECT_TEXT_NAME = 'Name (mehrsprachig)'; Bezeichnung = 'Bezeichnung'; Gastroname = 'Gastronomiename'
    Latitude = 'Breitengrad'; Longitude = 'Längengrad'; Altitude = 'Höhe'
    OBJECT_GEO_ALTITUDE_VON = 'Minimale Höhe'; OBJECT_GEO_ALTITUDE_BIS = 'Maximale Höhe'; OrtID = 'Orts-ID'
    OBJECT_GEO_POLYGON = 'Streckenverlauf'
    ROUTE_HOEHEMINIMUM = 'Minimale Höhe'; ROUTE_HOEHEMAXIMUM = 'Maximale Höhe'
    ROUTE_HOEHENMETER = 'Höhenmeter bergauf'; ROUTE_HOEHENMETER_DESC = 'Höhenmeter bergab'
    OBJECT_CONTACT_WEBSEITE1 = 'Website'; OBJECT_CONTACT_WEBSEITE1_XML = 'Website (mehrsprachig)'
    VO_LINK = 'Veranstaltungsort · Website'
}
$addressLabels = @{
    NAME = 'Name'; VORNAME = 'Vorname'; NACHNAME = 'Nachname'; FIRMA = 'Firma'
    STRASSE = 'Straße'; STREET = 'Straße'; PLZ = 'Postleitzahl'; COUNTRY = 'Land'; CITY = 'Ort'
    CITYID = 'Orts-ID'; ORTID = 'Orts-ID'; ORTSTEIL = 'Ortsteil'; DISTRICT = 'Ortsteil'
    LAT = 'Breitengrad'; LON = 'Längengrad'; EMAIL = 'E-Mail'; TEL = 'Telefon'
    FAX = 'Fax'; MOBIL = 'Mobiltelefon'
}
$addressRoles = @{
    OBJECT_CONTACT = ''; CONTACT = 'Ansprechpartner'; VO = 'Veranstaltungsort'
    VA = 'Veranstalter'; AP = 'Ansprechpartner'
}
foreach ($role in $addressRoles.Keys) {
    foreach ($field in $addressLabels.Keys) {
        $basisLabels["${role}_$field"] = (@($addressRoles[$role], $addressLabels[$field]) | Where-Object { $_ }) -join ' · '
    }
}

$contentLabels = @{
    OBJECT_TEXT_BESCHREIBUNG = 'Beschreibung'
    OBJECT_TEXT_BESCHREIBUNG_SOMMER_HTML = 'Beschreibung (HTML)'
    OBJECT_TEXT_TEASER = 'Kurzbeschreibung'
    OBJECT_TEXT_TEASER_SOMMER_HTML = 'Kurzbeschreibung (HTML)'
    OBJECT_TEXT_SUBTITEL = 'Untertitel'
    OBJECT_TEXT_WEITERE_INFO = 'Weitere Informationen'
    DETAILS_INFOTEXT = 'Veranstaltungshinweise'
    HYGIENE_Information = 'Hygienehinweise'
    OBJECT_ANREISE = 'Anreise'; OBJECT_ANREISE_LINK = 'Link zur Anreise'
    OBJECT_OEFFNUNGSZEITEN = 'Öffnungszeiten (Text)'
    PRICE_INFO = 'Preisinformation'; PRICE_ADULT = 'Preis für Erwachsene'; PRICE_CHILD = 'Preis für Kinder'
    PRICE_FAMILY = 'Familienpreis'; PRICE_REDUCED = 'Ermäßigter Preis'
    PRICE_KARTENLINK = 'Ticketlink'; PRICE_KARTENLINK_XML = 'Ticketlink (mehrsprachig)'
    Keywords = 'Stichworte'; Keywords_Ausgabekanal = 'Stichworte zum Ausgabekanal'
    Kuechenart = 'Küchenart'; TempClosed = 'Vorübergehend geschlossen'
    ROOM_SITZEINDOOR = 'Sitzplätze innen'; ROOM_SITZETERRASSE = 'Sitzplätze auf der Terrasse'
    ROOM_SITZENEBENZIMMER1 = 'Sitzplätze im Nebenzimmer'; ROOM_SONSTIGE = 'Weitere Angaben zu Räumen'
    ROUTE_START = 'Startpunkt'; ROUTE_ZIEL = 'Zielpunkt'; ROUTE_LAENGE = 'Streckenlänge'; ROUTE_DAUER = 'Dauer'
    INFO_KONDITION = 'Kondition'; INFO_PANORAMA = 'Panorama'; INFO_SCHWIERIGKEIT = 'Schwierigkeit'
    OBJECT_TOUREDITORDATASURFACES = 'Wegbeschaffenheit im Tourenplaner'
    GROUND_UNKNOWN = 'Untergrund · Unbekannt'; GROUND_ASPHALT = 'Untergrund · Asphalt'; GROUND_STREET = 'Untergrund · Straße'
    GROUND_GRAVEL = 'Untergrund · Schotter'; GROUND_TRAIL = 'Untergrund · Wanderweg'; GROUND_PATH = 'Untergrund · Pfad'
    GROUND_TRACKLESS = 'Untergrund · Weglos'; GROUND_VIAFERRATA = 'Untergrund · Klettersteig'; GROUND_SNOW = 'Untergrund · Schnee'
    GROUND_FERRY = 'Streckenabschnitt · Fähre'; GROUND_LIFT = 'Streckenabschnitt · Lift'; GROUND_DISMOUNT = 'Streckenabschnitt · Schiebestrecke'
    TourMoreInfos_additionalInformation = 'Weitere Toureninformationen'
    TourMoreInfos_directions = 'Wegbeschreibung'; TourMoreInfos_equipment = 'Ausrüstung'
    TourMoreInfos_gettingThere = 'Anfahrt'; TourMoreInfos_literature = 'Literatur'; TourMoreInfos_maps = 'Karten'
    TourMoreInfos_parking = 'Parken'; TourMoreInfos_publicTransit = 'Öffentliche Verkehrsmittel'
    TourMoreInfos_safetyGuidelines = 'Sicherheitshinweise'; TourMoreInfos_tip = 'Tipp'
    TourMoreInfos_trackSignage = 'Beschilderung'
    CONTACT_ANREDE = 'Ansprechpartner · Anrede'; CONTACT_WEBSEITE = 'Ansprechpartner · Website'
    CONTACT_WEBSEITE_XML = 'Ansprechpartner · Website (mehrsprachig)'; AP_COMPANY = 'Ansprechpartner · Firma'
    AP_LINK = 'Ansprechpartner · Website'; AP_LINK_XML = 'Ansprechpartner · Website (mehrsprachig)'
    VA_LINK = 'Veranstalter · Website'; VA_LINK_XML = 'Veranstalter · Website (mehrsprachig)'
    COPYRIGHT_TEXT = 'Urheberrecht · Name'; COPYRIGHT_EMAIL = 'Urheberrecht · E-Mail'; COPYRIGHT_WEBSEITE = 'Urheberrecht · Website'
    OBJECT_CREATIVECOMMONS = 'Lizenz'; Quellekey = 'Quell-ID'; C_LastChange = 'Letzte Änderung'
    SYSTEMID_Feratel = 'Feratel-Kennung'; SYSTEMID_outdooractive = 'Outdooractive-Kennung'
    SYSTEMID_RFA = 'RFA-Kennung'; SYSTEMID_Tripadvisor = 'Tripadvisor-Kennung'; SYSTEMID_TrustYou = 'TrustYou-Kennung'
    WEB_SEO_TITEL = 'Suchmaschinen · Titel'; WEB_SEO_BESCHREIBUNG = 'Suchmaschinen · Beschreibung'
    WEB_SEO_KEYWORDS = 'Suchmaschinen · Stichworte'; WEB_SEO_CANONICAL = 'Bevorzugte Webadresse'
    SOCIAL_FACEBOOK = 'Facebook'; SOCIAL_INSTAGRAM = 'Instagram'; SOCIAL_TWITTER = 'Twitter'
    SOCIAL_YOUTUBE = 'YouTube'; SOCIAL_WIKIPEDIA_XML = 'Wikipedia'
    MULTIMEDIA_VIDEO_TITEL = 'Videotitel'; MULTIMEDIA_VIDEO_URL = 'Videolink'
}
for ($i = 1; $i -le 3; $i++) {
    $contentLabels["BOOKING_TITEL${i}_XML"] = "Buchungstitel $i"
    $contentLabels["BOOKING_LINK${i}_XML"] = "Buchungslink $i"
}
$monthNames = [Globalization.CultureInfo]::GetCultureInfo('de-DE').DateTimeFormat.MonthNames
for ($i = 1; $i -le 12; $i++) {
    $contentLabels["INFO_SEASON_$i"] = "Saisoneignung · $($monthNames[$i - 1])"
}
$contentRoles = @{ AUTOR = 'Autor'; ORG = 'Organisation' }
foreach ($role in $contentRoles.Keys) {
    foreach ($suffix in ($addressLabels.Keys + @('ANREDE', 'TITEL', 'POSTFACH', 'WEBSEITE'))) {
        $label = switch ($suffix) {
            'ANREDE' { 'Anrede' }
            'TITEL' { 'Titel' }
            'POSTFACH' { 'Postfach' }
            'WEBSEITE' { 'Website' }
            default { $addressLabels[$suffix] }
        }
        $contentLabels["${role}_$suffix"] = "$($contentRoles[$role]) · $label"
    }
}

$sourceLabels = @{
    title = 'Name'
    'geo:lat' = 'Breitengrad'; 'geo:long' = 'Längengrad'; 'geo:altitude' = 'Höhe'
    'ec:elev_min' = 'Minimale Höhe'; 'ec:elev_max' = 'Maximale Höhe'
    'georss:polygon' = 'Streckenverlauf'
    'ec:total_ascent' = 'Höhenmeter bergauf'; 'ec:total_descent' = 'Höhenmeter bergab'
    'ec:alt_diff' = 'Höhenunterschied'
    crawlerOrtId = 'Ermittelte Orts-ID'
    'util:FixLink(link)' = 'Website'
    "util:FixLink(ec:link[@rel='venuewebsite']/@url)" = 'Veranstaltungsort · Website'
    "util:FixLink(ec:link[@rel='other']/@url)" = 'Veranstaltungsort · Weiterer Link'
    'ec:family_friendly' = 'Familienfreundlich'; 'ec:rest_stop' = 'Einkehrmöglichkeit'; 'ec:round_tour' = 'Rundweg'
    'ec:features/ec:feature' = 'Merkmalsliste'
}
$sourceAddressLabels = @{
    name = 'Name'; firstname = 'Vorname'; lastname = 'Nachname'; vorname = 'Vorname'; nachname = 'Nachname'
    company = 'Firma'; country = 'Land'; zip = 'Postleitzahl'; plz = 'Postleitzahl'; city = 'Ort'
    district = 'Ortsteil'; email = 'E-Mail'; mail = 'E-Mail'; fax = 'Fax'
    mobile = 'Mobiltelefon'; phone2 = 'Weitere Telefonnummer'; phone = 'Telefon'; tel = 'Telefon'; street = 'Straße'
}
$observedPaths = @{
    event = @{
        title = 'title'; 'geo:lat' = 'point[1]'; 'geo:long' = 'point[0]'
        'ec:name' = 'locationInfo.name'; 'ec:city' = 'locationInfo.address.town'
        'ec:plz' = 'locationInfo.address.zipcode'; 'ec:country' = 'locationInfo.address.country'
        'util:FixLink(link)' = 'homepage'; '$organizer/name' = 'organizer.name'
    }
    gastro = @{
        title = 'title'; 'geo:lat' = 'point[1]'; 'geo:long' = 'point[0]'
        'ec:street' = 'contact.address.street'; 'ec:tel' = 'contact.phone'
        'ec:fax' = 'contact.fax'; 'ec:email' = 'contact.email'
    }
}

function Get-SourceLabel($source, $target) {
    if ($sourceLabels.ContainsKey($source)) { return $sourceLabels[$source] }
    if ($source -like 'util:GetOrtId(*)') {
        $role = if ($source -match 'organizer') { 'Veranstalter' } else { 'Ansprechpartner' }
        return "$role · Land, Postleitzahl und Ort"
    }
    if ($source -match '^(\$contact_person/|ec:contact_|\$organizer/|ec:organizer_|ec:)([a-z0-9]+)$') {
        $label = $sourceAddressLabels[$Matches[2]]
        $role = switch ($Matches[1]) {
            { $_ -in '$contact_person/', 'ec:contact_' } { 'Ansprechpartner' }
            { $_ -in '$organizer/', 'ec:organizer_' } { 'Veranstalter' }
            'ec:' { if ($target -like 'VO_*') { 'Veranstaltungsort' } }
        }
        if ($label) { return (@($role, $label) | Where-Object { $_ }) -join ' · ' }
    }
    throw "Missing source label for $source."
}

function Get-Targets($elements, $copyValue, $schemaNamespace, $type, $sourceLabel) {
    foreach ($element in $elements) {
        $field = $element.LocalName
        if ($field -match '^(ACCESSIBILITY_|DETAILS_BARRIERFREE$|INFO_BARRIEREFREI$|OBJECT_HANDICAPPED_ACCESS$)') { continue }
        $label = $basisLabels[$field]
        if (!$label) { $label = $contentLabels[$field] }
        if (!$label) { $label = $fieldLabels[$field] }
        if (!$label) { $label = $fallbackLabels[$field] }
        if (!$label) { $label = if ($sourceLabel) { $sourceLabel } else { $field } }
        $target = [ordered]@{ field = $field; label = $label; value = if ($copyValue) { $null } else { $element.InnerText.Trim() } }
        if ($verifiedLabels[$type][$field]) { $target.displayLabel = $verifiedLabels[$type][$field] }
        if ($element.NamespaceURI -and $element.NamespaceURI -cne $schemaNamespace) { $target.namespace = $element.NamespaceURI }
        Add-EditorLocation $target $type $field
    }
}

function Get-ContentSourceLabel($select, $field) {
    if ($select -match "ec:text\[@rel='moreInfo'") { return 'Weitere Informationen' }
    if ($select -ceq '$author/name') { return 'Autor · Name' }
    if ($select -match '^util:GetOrtId\(') { return $contentLabels[$field] -replace 'Orts-ID$', 'Land, Postleitzahl und Ort' }
    if ($field -eq 'OBJECT_TOUREDITORDATASURFACES') { return 'Wegbeschaffenheit' }
    $contentLabels[$field] -replace '^Buchungstitel \d$', 'Buchungstitel' -replace '^Buchungslink \d$', 'Buchungslink'
}

function Get-BasisConditions($value, $ns) {
    $conditions = foreach ($branch in $value.SelectNodes('ancestor::xsl:if | ancestor::xsl:when | ancestor::xsl:otherwise', $ns)) {
        foreach ($previous in $branch.SelectNodes('preceding-sibling::xsl:when', $ns)) {
            'not(' + $previous.GetAttribute('test') + ')'
        }
        if ($branch.HasAttribute('test')) { $branch.GetAttribute('test') }
    }
    if (@($conditions).Count -gt 1) { return ($conditions | ForEach-Object { "($_)" }) -join ' and ' }
    $conditions
}

$tabs = @(
    foreach ($type in $editorNames.Keys) {
        $editor = $editors[$type]
        $categoryField = if ($type -eq 'gastro') { 'Betriebsart' } else { 'Kategorie' }
        $categoryPaths = @($editor.byName[$categoryField] | Where-Object { $_ })
        $valuePaths = [ordered]@{}
        foreach ($value in ($documentedFeatures | Where-Object { $_.target.datasetType -eq $type } | ForEach-Object { $_.target.values } | Sort-Object -Unique)) {
            if ($editor.valuePaths.Keys -ccontains $value) { $valuePaths[$value] = $editor.valuePaths[$value] }
        }
        if (!$stylesheets.Contains($type)) {
            [ordered]@{ id = $type; rows = @(); categoryPaths = $categoryPaths; valuePaths = $valuePaths }
            continue
        }
        $file = $stylesheets[$type]
        $xml = Read-Xml (Join-Path $XsltDirectory $file)
        $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
        $ns.AddNamespace('xsl', $xsl)
        $schemaNamespace = 'urn:schemas-etourist:' + [IO.Path]::GetFileNameWithoutExtension($file)

        $rows = @(
            foreach ($example in ($observations.examples | Where-Object datasetType -eq $type)) {
                foreach ($observation in ($example.rows | Where-Object { ($_.includeInBasis -or $_.displayGroup) -and $_.satourn })) {
                    $editorField = if ($observation.editorField) { $observation.editorField } else { $observation.satourn }
                    $target = [ordered]@{
                        field = $observation.satourn
                        label = if ($observation.satournLabel) { $observation.satournLabel } else { $observation.field }
                        displayLabel = $observation.satournLabel
                        value = $null
                    }
                    if ($observation.editorPaths) { $target.paths = @($observation.editorPaths) }
                    [ordered]@{
                        group = if ($observation.displayGroup) { $observation.displayGroup } else { 'basis' }
                        sources = @($observation.outdooractive)
                        sourceLabel = $observation.field
                        targets = @(Add-EditorLocation $target $type $editorField $observation.satournLabel)
                        evidence = [ordered]@{ kind = 'json-observation'; outdooractiveId = $example.outdooractiveId; satournId = $example.satournId }
                    }
                }
            }
            foreach ($field in $xml.SelectNodes('//*[namespace-uri() != "http://www.w3.org/1999/XSL/Transform"]')) {
                $fieldName = $field.LocalName
                $isBasis = $basisLabels.ContainsKey($fieldName)
                if (!$isBasis -and !$contentLabels.ContainsKey($fieldName)) { continue }
                foreach ($value in $field.SelectNodes('.//xsl:value-of | .//xsl:call-template[@name="JoinWithComma"]', $ns)) {
                    $select = $value.GetAttribute('select')
                    if (!$select) { $select = $value.SelectSingleNode('./xsl:with-param[@name="list"]', $ns).GetAttribute('select') }
                    if ($select -cmatch '^\$([A-Za-z_]\w*)$') {
                        $variable = $value.SelectSingleNode("preceding::xsl:variable[@name='$($Matches[1])' and @select][1]", $ns)
                        if ($variable) { $select = $variable.GetAttribute('select') }
                    }
                    $row = [ordered]@{
                        group = if ($isBasis) { 'basis' } else { 'content' }
                        sources = @($select)
                        sourceLabel = if ($isBasis) { Get-SourceLabel $select $fieldName } else { Get-ContentSourceLabel $select $fieldName }
                        targets = @(Get-Targets $field $true $schemaNamespace $type)
                    }
                    $context = $value.SelectSingleNode('ancestor::xsl:for-each[1]', $ns)
                    if ($context) { $row.context = $context.GetAttribute('select') }
                    if ($observedPaths[$type] -and $observedPaths[$type].ContainsKey($select)) {
                        $row.outdooractivePath = $observedPaths[$type][$select]
                    }
                    $condition = Get-BasisConditions $value $ns
                    if ($condition) { $row.condition = $condition }
                    $row
                }
            }
            foreach ($loop in $xml.SelectNodes('//xsl:for-each[@select="ec:features/ec:feature"]', $ns)) {
                $condition = ($loop.SelectNodes('ancestor::xsl:when | ancestor::xsl:if', $ns) | ForEach-Object { $_.GetAttribute('test') }) -join ' and '
                foreach ($rule in $loop.SelectNodes('./xsl:choose/xsl:when', $ns)) {
                    $test = $rule.GetAttribute('test')
                    if ($test -cnotmatch "^\.\s*=\s*'[^']+'(?:\s+or\s+\.\s*=\s*'[^']+')*$") { throw "Unsupported feature rule in ${file}: $test" }
                    $values = @([regex]::Matches($test, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value })
                    $targets = @(Get-Targets $rule.SelectNodes('./*[namespace-uri() != "http://www.w3.org/1999/XSL/Transform"]', $ns) $false $schemaNamespace $type $values[0])
                    if (!$targets.Count) { continue }
                    $row = [ordered]@{
                        sources = $values
                        targets = $targets
                    }
                    if ($condition) { $row.condition = $condition }
                    $row
                }
                foreach ($field in $loop.SelectNodes('./*[xsl:value-of/@select = "."]', $ns)) {
                    $source = 'ec:features/ec:feature'
                    [ordered]@{ sources = @($source); sourceLabel = $sourceLabels[$source]; targets = @(Get-Targets $field $true $schemaNamespace $type) }
                }
            }
            $directFields = '//xsl:value-of[@select="ec:family_friendly" or @select="ec:rest_stop" or @select="ec:round_tour"]'
            foreach ($value in $xml.SelectNodes($directFields, $ns)) {
                $source = $value.GetAttribute('select')
                [ordered]@{ sources = @($source); sourceLabel = $sourceLabels[$source]; targets = @(Get-Targets $value.ParentNode $true $schemaNamespace $type) }
            }
        )
        [ordered]@{ id = $type; file = $file; rows = $rows; categoryPaths = $categoryPaths; valuePaths = $valuePaths }
    }
)

$destination = Join-Path $root 'data/feature-mappings.json'
$json = @{ tabs = $tabs } | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($destination, $json + "`n", [Text.UTF8Encoding]::new($false))
