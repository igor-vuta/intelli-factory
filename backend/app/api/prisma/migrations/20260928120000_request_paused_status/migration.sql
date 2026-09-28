-- A customer can stop a request from collecting new bids and resume it later.
ALTER TYPE "RequestStatus" ADD VALUE 'PAUSED';
