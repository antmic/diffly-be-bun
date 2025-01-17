# tag it as build
FROM oven/bun AS build 

WORKDIR /app

COPY bun.lockb .
COPY package.json .

EXPOSE 3000/tcp

RUN bun install --frozen-lockfile

COPY src ./src

# compile everything to a binary called cli which includes the bun runtime
RUN bun build ./src/index.ts --compile --outfile cli

# use a smaller image without bun
FROM ubuntu:22.04 

WORKDIR /app

# copy the compiled binary from the build image
COPY --from=build /app/cli /app/cli

# execute the binary!
CMD ["/app/cli"]