FROM osrm/osrm-backend:latest
WORKDIR /data
# Copy the pre-built Delhi NCR routing data into the image
COPY data/ .
# Start the OSRM routing engine with MLD (Multi-Level Dijkstra)
CMD ["osrm-routed", "--algorithm", "mld", "/data/region.osrm"]
