{{- define "vigil.labels" -}}
app.kubernetes.io/name: vigil
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
