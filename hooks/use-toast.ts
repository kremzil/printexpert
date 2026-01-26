export function useToast() {
  return {
    toast: ({ title, description, variant }: { title: string; description?: string; variant?: "default" | "destructive" }) => {
      // Простая реализация через alert (можно заменить на более продвинутую)
      if (variant === "destructive") {
        alert(`${title}${description ? '\n' + description : ''}`)
      } else {
        console.log(title, description)
        // Можно добавить нотификацию
      }
    }
  }
}
