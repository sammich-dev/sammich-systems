export         function getCatchResponseError(res:any) {
    return function (error:any) {
        return res.status(500).send({
            error,
            message: error?.message||undefined
        });
    }
}