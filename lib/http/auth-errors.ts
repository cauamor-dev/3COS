/** Keep quota failures distinct from the short anti-abuse cooldown. */
export function loginEmailError(error: {
  code?: string;
  status?: number;
  message: string;
}) {
  if (
    error.code === "over_email_send_rate_limit" ||
    /email rate limit exceeded/i.test(error.message)
  )
    return "O envio de links atingiu o limite temporário de e-mails. A liberação pode levar até uma hora. Aguarde antes de pedir outro link.";
  if (error.status === 429)
    return "Muitas tentativas de acesso. Aguarde alguns minutos antes de tentar novamente.";
  if (/signups? not allowed|not found/i.test(error.message))
    return "Este e-mail não tem acesso a esta Central.";
  return "Não foi possível enviar o link de acesso. Tente novamente mais tarde.";
}
