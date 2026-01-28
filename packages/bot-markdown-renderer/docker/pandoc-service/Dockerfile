# Use Ubuntu as base for better Pandoc support
FROM ubuntu:24.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    python3 \
    python3-pip \
    # LaTeX dependencies
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    # Additional tools
    imagemagick \
    librsvg2-bin \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install WeasyPrint for HTML to PDF conversion
RUN pip3 install weasyprint

# Install Pandoc (latest version)
RUN wget https://github.com/jgm/pandoc/releases/download/3.1.8/pandoc-3.1.8-1-amd64.deb \
    && dpkg -i pandoc-3.1.8-1-amd64.deb \
    && rm pandoc-3.1.8-1-amd64.deb

# Install Typst (optional, for Typst engine support)
RUN wget https://github.com/typst/typst/releases/download/v0.8.0/typst-x86_64-unknown-linux-musl.tar.xz \
    && tar -xf typst-x86_64-unknown-linux-musl.tar.xz \
    && mv typst-x86_64-unknown-linux-musl/typst /usr/local/bin/ \
    && rm -rf typst-*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --only=production

# Copy service code
COPY service.js ./

# Create non-root user for security
RUN useradd -r -s /bin/false pandoc-user \
    && chown -R pandoc-user:pandoc-user /app

# Switch to non-root user
USER pandoc-user

# Expose service port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the service
CMD ["npm", "start"]