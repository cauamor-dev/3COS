$ErrorActionPreference = 'Stop'
# Executado pelo proprietário; token fora da linha de comando e do histórico.
$cursorSecret = Read-Host 'Cole o token individual do Cursor gerado na Central (entrada oculta)' -AsSecureString
$cursorPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cursorSecret)
try {
  $cursorToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cursorPointer)
  if ($cursorToken -notmatch '^c3c_[a-f0-9]{64}$') { throw 'Formato inválido. Use o token individual do Cursor, não uma chave Supabase ou Groq.' }
  [Environment]::SetEnvironmentVariable('CENTRAL_3C_CURSOR_TOKEN', $cursorToken, 'User')
  Write-Host 'Configurado para seu usuário Windows. Feche completamente e reabra o Cursor. Não envie o token no chat.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cursorPointer)
  $cursorToken = $null
  $cursorSecret.Dispose()
}
