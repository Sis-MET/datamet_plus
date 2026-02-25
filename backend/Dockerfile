# Usar la imagen de Node.js LTS (Iron - 20) basada en Alpine para un menor peso
FROM node:20-alpine

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiar los artchivos del package manager para instalar dependencias primero
# Esto aprovecha el caché de Docker si el package.json no ha cambiado
COPY package*.json ./

# Instalar las dependencias de producción
# Omitimos dependencias de desarrollo para imagen más ligera y segura
RUN npm ci --only=production

# Copiar el código fuente de la aplicación al contenedor
COPY src/ src/

# Exponer el puerto en el que la aplicación escuchará
EXPOSE 3000

# Comando para iniciar la aplicación (sin dependencias globales como nodemon)
CMD ["npm", "start"]
