$file = "e:\DOC\AI voice assistance - Copy - Copy\drivebook\app\api\client\bookings\[id]\reschedule\route.ts"
$content = [IO.File]::ReadAllText($file)

$old = "    } catch (txErr: any) {" + "`r`n" +
       "      if (txErr?.code === 'INSUFFICIENT_BALANCE') {"

$new = "    } catch (txErr: any) {" + "`r`n" +
       "      if (txErr?.code === 'SLOT_CONFLICT') {" + "`r`n" +
       "        return NextResponse.json({ error: 'The new time conflicts with an existing booking. Please choose a different time.' }, { status: 409 });" + "`r`n" +
       "      }" + "`r`n" +
       "      if (txErr?.code === 'INSUFFICIENT_BALANCE') {"

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
    [IO.File]::WriteAllText($file, $content)
    Write-Host "Done."
} else {
    $old2 = $old.Replace("`r`n", "`n")
    $new2 = $new.Replace("`r`n", "`n")
    if ($content.Contains($old2)) {
        $content = $content.Replace($old2, $new2)
        [IO.File]::WriteAllText($file, $content)
        Write-Host "Done (LF)."
    } else {
        Write-Host "ERROR: catch pattern not found"
        exit 1
    }
}
