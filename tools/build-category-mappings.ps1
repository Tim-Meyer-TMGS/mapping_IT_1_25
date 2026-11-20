param(
    [Parameter(Mandatory)][string]$Workbook,
    [Parameter(Mandatory)][string]$CategoryDirectory,
    [Parameter(Mandatory)][string]$AdditionalMappingDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$tabs = [ordered]@{
    tour = 'Touren'
    event = 'Veranstaltungen'
    poi = 'POI'
    gastro = 'Gastronomie'
    accommodation = 'Gastgeber'
    package = 'Angebote'
}
$categoryFiles = @{
    tour = 'Tour.xml'
    event = 'Veranstaltungen.xml'
    poi = 'POITree.xml'
    gastro = 'Gastronomie.xml'
    accommodation = 'Gastgeber.xml'
}
$damasFiles = @{
    tour = 'Tour_Damas.XML'
    event = 'Veranstaltungen_Damas.xml'
    poi = 'POI_Damas.xml'
    gastro = 'Gastro_Damas.xml'
    accommodation = 'Unterkünfte_Damas.xml'
}

function Read-ZipXml($zip, $path) {
    $reader = [IO.StreamReader]::new($zip.GetEntry($path).Open())
    try { [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Read-WorkbookRows($path, $sheetName) {
    $zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $path).Path)
    try {
        $book = Read-ZipXml $zip 'xl/workbook.xml'
        $sheet = $book.workbook.sheets.sheet | Where-Object name -CEQ $sheetName
        if (!$sheet) { throw "Worksheet '$sheetName' missing in $path." }
        $relationId = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $relations = Read-ZipXml $zip 'xl/_rels/workbook.xml.rels'
        $relation = $relations.Relationships.Relationship | Where-Object Id -CEQ $relationId
        $sheetPath = [uri]::new([uri]'https://workbook.invalid/xl/workbook.xml', $relation.Target).AbsolutePath.TrimStart('/')
        $sheetXml = Read-ZipXml $zip $sheetPath
        $strings = @()
        if ($zip.GetEntry('xl/sharedStrings.xml')) {
            $strings = @((Read-ZipXml $zip 'xl/sharedStrings.xml').sst.si | ForEach-Object { $_.InnerText })
        }
        foreach ($row in $sheetXml.worksheet.sheetData.row) {
            $cells = @{}
            foreach ($cell in $row.c) {
                $cells[$cell.r -replace '\d+$'] = switch ($cell.t) {
                    's' { $strings[[int]$cell.v] }
                    'inlineStr' { $cell.is.InnerText }
                    default { $cell.v }
                }
            }
            $cells
        }
    } finally { $zip.Dispose() }
}

function Read-Xml($path) {
    [xml]([IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path).TrimStart())
}

function Get-CategoryRow($categories, $name) {
    if (!$categories.ContainsKey($name)) {
        $categories.Add($name, [ordered]@{ satourn = $name; outdooractive = @(); deskline = @(); damas = @(); odta = @() })
    }
    $categories[$name]
}

function New-OutdooractiveGap($source, $categoryId) {
    $row = [ordered]@{ satourn = $null; outdooractive = @($source); deskline = @(); damas = @(); odta = @() }
    if ($categoryId) { $row.outdooractiveCategoryId = $categoryId }
    $row
}

$outdooractiveCategories = @(Read-WorkbookRows $Workbook 'Alle Kategorien' | Select-Object -Skip 1)
$outdooractiveRules = @(Read-WorkbookRows $Workbook 'Alle XML-Mappingregeln' | Select-Object -Skip 1)
foreach ($rule in $outdooractiveRules) {
    if (!$rule.B -or !$rule.C -or $tabs.Values -cnotcontains $rule.A) {
        throw "Invalid Outdooractive rule: $($rule.A) / $($rule.B) / $($rule.C)."
    }
}
$desklineFilename = 'Feratel-Mapping.xlsx'
$desklineSheet = @(Read-WorkbookRows (Join-Path $AdditionalMappingDirectory $desklineFilename) 'Tabelle1')
if ($desklineSheet[0].A -cne 'Deskline' -or $desklineSheet[0].B -cne 'GUID' -or $desklineSheet[0].C -cne 'SaTourN') {
    throw 'Unexpected columns in the Deskline workbook.'
}
$desklineRules = @($desklineSheet | Select-Object -Skip 1 | Where-Object { $_.A -and $_.C })

$result = @(
    foreach ($id in $tabs.Keys) {
        $categories = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
        $treeNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        if ($categoryFiles.ContainsKey($id)) {
            $tree = Read-Xml (Join-Path $CategoryDirectory $categoryFiles[$id])
            foreach ($category in $tree.SelectNodes('/Categories//Category')) {
                $name = $category.GetAttribute('Name')
                $null = $treeNames.Add($name)
                $values = @($category.GetAttribute('schemaorg').Split(',').Trim() | Where-Object { $_ })
                $kind = $category.GetAttribute('OdtaKind').Trim()
                if (!$values.Count -and !$kind) { continue }
                $row = Get-CategoryRow $categories $name
                $row.odta = $values
                if ($kind) { $row.odtaKind = $kind }
            }
        }
        $outdooractiveGaps = @()
        if ($id -notin 'accommodation', 'package') {
            $missingRuleSources = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
            foreach ($rule in ($outdooractiveRules | Where-Object { $_.A -ceq $tabs[$id] })) {
                if (!$treeNames.Contains($rule.C)) {
                    $null = $missingRuleSources.Add($rule.B)
                    continue
                }
                $row = Get-CategoryRow $categories $rule.C
                if ($row.outdooractive -cnotcontains $rule.B) { $row.outdooractive += $rule.B }
            }
            $gapGroups = $outdooractiveCategories |
                Where-Object { $_.A -ceq $tabs[$id] -and (!$_.F -or $missingRuleSources.Contains($_.C)) } |
                Group-Object -CaseSensitive { $_.C }
            $outdooractiveGaps = @(
                foreach ($group in $gapGroups) {
                    $null = $missingRuleSources.Remove($group.Name)
                    foreach ($source in $group.Group) {
                        $categoryId = if ($group.Count -gt 1) { $source.D }
                        New-OutdooractiveGap $source.C $categoryId
                    }
                }
                foreach ($source in $missingRuleSources) { New-OutdooractiveGap $source }
            )
        }
        if ($id -eq 'accommodation') {
            foreach ($rule in $desklineRules) {
                $row = Get-CategoryRow $categories $rule.C.Trim()
                $row.deskline += [ordered]@{ label = $rule.A.Trim(); guid = $rule.B }
            }
        }
        if ($damasFiles.ContainsKey($id)) {
            $damas = Read-Xml (Join-Path $AdditionalMappingDirectory $damasFiles[$id])
            foreach ($rule in $damas.SelectNodes('/Mappings/CategoryMapping/Mapping')) {
                $source = $rule.GetAttribute('Foreign').Trim()
                $target = $rule.GetAttribute('done').Trim()
                if (!$source -or !$target) { continue }
                $row = Get-CategoryRow $categories $target
                if ($row.damas -cnotcontains $source) { $row.damas += $source }
            }
        }
        $rows = @($categories.Values | Sort-Object -Culture de-DE { $_.satourn })
        $rows += @($outdooractiveGaps | Sort-Object -Culture de-DE { $_.outdooractive[0] }, { $_.outdooractiveCategoryId })
        [ordered]@{ id = $id; label = $tabs[$id]; rows = $rows }
    }
)

$sources = [ordered]@{
    outdooractive = [IO.Path]::GetFileName($Workbook)
    deskline = $desklineFilename
    damas = @($tabs.Keys | ForEach-Object { $damasFiles[$_] } | Where-Object { $_ })
    odta = @($tabs.Keys | ForEach-Object { $categoryFiles[$_] } | Where-Object { $_ })
}
$tabJson = foreach ($tab in $result) {
    $json = $tab | ConvertTo-Json -Depth 6 -Compress
    if (!$tab.rows.Count) { '    ' + $json; continue }
    $firstRow = $json.IndexOf('"rows":[') + '"rows":['.Length
    $rows = $tab.rows | ForEach-Object { '      ' + ($_ | ConvertTo-Json -Depth 4 -Compress) }
    '    ' + $json.Substring(0, $firstRow) + "`n" + ($rows -join ",`n") + "`n    ]}"
}
$output = "{`n  `"sources`": " + ($sources | ConvertTo-Json -Compress) + ",`n  `"tabs`": [`n" + ($tabJson -join ",`n") + "`n  ]`n}`n"
$destination = Join-Path (Split-Path $PSScriptRoot) 'data/category-mappings.json'
[IO.File]::WriteAllText($destination, $output, [Text.UTF8Encoding]::new($false))
